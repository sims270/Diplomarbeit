-- Zeitlich begrenzte Zugänge für fremde Fahrer.
--
-- Fremdaufträge gehen an Subunternehmer. Deren Fahrer sollen CMR und Fotos
-- direkt in der App hochladen, statt sie per Mail oder WhatsApp zu
-- schicken. Dafür legt der Chef je fremder Firma bzw. fremdem Fahrer einen
-- Zugang an (Edge Function create-external-driver) und weist ihm beliebig
-- viele Fremdaufträge zu — wie assigned_to bei den eigenen Fahrern.
--
-- Der fremde Fahrer sieht ausschließlich die ihm zugewiesenen Aufträge, und
-- zwar ohne Preise (Frachtrate, Termin-Zuschlag, Zahlungskonditionen). Er
-- liest sie nicht direkt aus external_orders — dort gibt es für ihn keine
-- Policy —, sondern über get_my_external_orders, das genau die
-- unverfänglichen Spalten liefert. RLS prüft Zeilen, nicht Spalten; eine
-- select-Policy gäbe ihm die Preise gleich mit.
--
-- Jeder Zugang hat ein Ablaufdatum. Danach ist er sofort gesperrt: Jede
-- Funktion und Policy unten prüft das Datum selbst, ein Cron-Job ist nicht
-- nötig. Gelöscht wird er erst, wenn der Chef das bestätigt (Edge Function
-- delete-external-driver) — sonst verlängert er ihn.
--
-- Setzt 20260915110000_create_profiles.sql und
-- 20260915120000_add_cmr_to_orders.sql voraus. Wie alle Migrationen dieses
-- Projekts beliebig oft ausführbar.

-- --- 1. Status am Fremdauftrag ----------------------------------------------
-- Dieselben Werte wie bei orders.status: 'pending' bis zum Abschluss, dann
-- 'completed'.
alter table public.external_orders
  add column if not exists status text not null default 'pending',
  add column if not exists completed_at timestamptz;

-- --- 2. Zugänge ---------------------------------------------------------------
-- Ein Zugang je fremder Firma bzw. fremdem Fahrer.
--
-- password: Der Chef soll das Passwort erneut anzeigen können, wenn der
-- fremde Fahrer es vergessen hat. Dafür muss es gespeichert sein, im
-- Klartext. Vertretbar, weil der Zugang zeitlich begrenzt ist und nur
-- zugewiesene Aufträge ohne Preise sieht. Lesen darf es nur der Chef — für
-- den fremden Fahrer gibt es auf dieser Tabelle gar keine Policy, und keine
-- Funktion gibt es an ihn heraus. Die Passwörter der eigenen Fahrer und des
-- Chefs werden weiterhin nirgends gespeichert.
--
-- expires_on: der letzte Tag, an dem der Zugang gilt, bis 23:59 Wiener
-- Zeit. Bewusst ein Datum und kein Zeitpunkt — "gültig bis 30.9." meint den
-- ganzen Tag, nicht 00:00 UTC.
create table if not exists public.external_driver_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  password text not null,
  -- Firmenname zum Wiedererkennen in der Auswahl beim Auftrag.
  label text not null default '',
  expires_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- --- 3. Zuweisung am Fremdauftrag -------------------------------------------
-- on delete set null: Wird der Zugang gelöscht, bleiben Auftrag, Belege und
-- cmr erhalten, nur die Zuweisung fällt weg.
alter table public.external_orders
  add column if not exists assigned_external_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists external_orders_assigned_external_user_id_idx
  on public.external_orders (assigned_external_user_id);

-- --- 4. Hilfsfunktionen -------------------------------------------------------
create or replace function public.vienna_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Vienna')::date;
$$;

-- Hat der aufrufende Nutzer einen gültigen Zugang als fremder Fahrer?
-- security definer, weil der fremde Fahrer external_driver_accounts selbst
-- nicht lesen darf.
create or replace function public.has_active_external_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_role() = 'external_driver'
     and exists (
       select 1
         from public.external_driver_accounts a
        where a.user_id = auth.uid()
          and a.expires_on >= public.vienna_today()
     );
$$;

-- Ist der Fremdauftrag (als Ordnername im Bucket, also Text) dem
-- aufrufenden fremden Fahrer zugewiesen und sein Zugang gültig?
-- p_require_open: nur solange der Auftrag nicht erledigt ist.
-- security definer, weil der fremde Fahrer external_orders per RLS nicht
-- lesen darf — die Storage-Policies unten liefen sonst immer ins Leere.
create or replace function public.is_my_external_order(
  p_order_id text,
  p_require_open boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_external_access()
     and exists (
       select 1
         from public.external_orders e
        where e.id::text = p_order_id
          and e.assigned_external_user_id = auth.uid()
          and (not p_require_open or e.status <> 'completed')
     );
$$;

revoke all on function public.has_active_external_access() from public;
revoke all on function public.has_active_external_access() from anon;
grant execute on function public.has_active_external_access() to authenticated;

revoke all on function public.is_my_external_order(text, boolean) from public;
revoke all on function public.is_my_external_order(text, boolean) from anon;
grant execute on function public.is_my_external_order(text, boolean) to authenticated;

-- --- 5. Rechte auf den Zugängen ---------------------------------------------
-- Der Chef liest alle Zugänge samt Passwort und darf verlängern bzw. den
-- Namen ändern. Angelegt und gelöscht wird nur über die Edge Functions,
-- weil dazu auch das Auth-Konto entsteht bzw. verschwindet.
alter table public.external_driver_accounts enable row level security;

drop policy if exists "Boss can read external driver accounts" on public.external_driver_accounts;
create policy "Boss can read external driver accounts"
  on public.external_driver_accounts for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can extend external driver accounts" on public.external_driver_accounts;
create policy "Boss can extend external driver accounts"
  on public.external_driver_accounts for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- RLS prüft Zeilen, nicht Spalten. Benutzername und Passwort müssen zum
-- Auth-Konto passen, sonst zeigt die App ein Passwort an, mit dem die
-- Anmeldung scheitert — deshalb darf ein Client nur diese beiden Spalten
-- ändern.
revoke update on public.external_driver_accounts from authenticated;
grant update (expires_on, label) on public.external_driver_accounts to authenticated;

-- --- 6. Aufträge für den fremden Fahrer -------------------------------------
-- Ohne freight_rate, deadline_surcharge und payment_terms, ohne Ansprech-
-- partner und created_by.
drop function if exists public.get_my_external_orders();

create or replace function public.get_my_external_orders()
returns table (
  id uuid,
  order_nr text,
  status text,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  loading_date date,
  loading_time_from text,
  loading_time_until text,
  loading_company text,
  loading_address text,
  loading_number text,
  cargo_description text,
  loading_meters text,
  unloading_date date,
  unloading_time_from text,
  unloading_time_until text,
  unloading_company text,
  unloading_address text,
  vehicle_type text,
  notes text,
  license_plate text,
  driver_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.order_nr, e.status, e.completed_at, e.created_at, e.updated_at,
         e.loading_date, e.loading_time_from, e.loading_time_until,
         e.loading_company, e.loading_address, e.loading_number,
         e.cargo_description, e.loading_meters,
         e.unloading_date, e.unloading_time_from, e.unloading_time_until,
         e.unloading_company, e.unloading_address,
         e.vehicle_type, e.notes, e.license_plate, e.driver_name
    from public.external_orders e
   where e.assigned_external_user_id = auth.uid()
     and public.has_active_external_access()
   order by e.loading_date nulls last, e.created_at;
$$;

-- Der eigene Zugang: Name und Ablaufdatum, ohne Passwort. Liefert die Zeile
-- auch nach dem Ablauf, damit die App "Zugang abgelaufen" anzeigen kann
-- statt einer leeren Liste.
drop function if exists public.get_my_external_access();

create or replace function public.get_my_external_access()
returns table (
  username text,
  label text,
  expires_on date,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.username, a.label, a.expires_on,
         a.expires_on >= public.vienna_today()
    from public.external_driver_accounts a
   where a.user_id = auth.uid()
     and public.app_role() = 'external_driver';
$$;

-- Wie complete_order bei den eigenen Fahrern (20260908110000): kann genau
-- eine Sache, den zugewiesenen Auftrag als erledigt markieren. Gibt bewusst
-- nicht die Zeile zurück — darin stünden die Preise.
create or replace function public.complete_external_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_active_external_access() then
    raise exception 'Zugang abgelaufen oder keine Berechtigung'
      using errcode = 'insufficient_privilege';
  end if;

  update public.external_orders e
     set status = 'completed',
         completed_at = now(),
         updated_at = now()
   where e.id = complete_external_order.order_id
     and e.assigned_external_user_id = auth.uid()
     and e.status <> 'completed';

  if not found then
    raise exception 'Auftrag nicht gefunden, nicht zugewiesen oder schon erledigt'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.get_my_external_orders() from public;
revoke all on function public.get_my_external_orders() from anon;
grant execute on function public.get_my_external_orders() to authenticated;

revoke all on function public.get_my_external_access() from public;
revoke all on function public.get_my_external_access() from anon;
grant execute on function public.get_my_external_access() to authenticated;

revoke all on function public.complete_external_order(uuid) from public;
revoke all on function public.complete_external_order(uuid) from anon;
grant execute on function public.complete_external_order(uuid) to authenticated;

-- --- 7. CMR vermerken, jetzt auch durch den fremden Fahrer ------------------
-- Ersetzt die Fassung aus 20260915120000_add_cmr_to_orders.sql um den Fall
-- "fremder Fahrer".
create or replace function public.can_write_order_documents(
  p_order_id uuid,
  p_removing boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.app_role();
begin
  if v_role = 'boss' then
    return exists (select 1 from public.orders where id = p_order_id)
        or exists (select 1 from public.external_orders where id = p_order_id);
  end if;

  if v_role = 'driver' then
    return exists (
      select 1
        from public.orders o
       where o.id = p_order_id
         and o.assigned_to = auth.uid()
         and (not p_removing or o.status <> 'completed')
    );
  end if;

  if v_role = 'external_driver' then
    return public.is_my_external_order(p_order_id::text, p_removing);
  end if;

  return false;
end;
$$;

revoke all on function public.can_write_order_documents(uuid, boolean) from public;
revoke all on function public.can_write_order_documents(uuid, boolean) from anon;
revoke all on function public.can_write_order_documents(uuid, boolean) from authenticated;

-- --- 8. Storage: Belege der Fremdaufträge -----------------------------------
-- Derselbe Bucket, ein Ordner je Fremdauftrag (external_orders.id). Die
-- UUIDs kollidieren nicht mit orders.id.
drop policy if exists "External driver uploads documents for assigned orders" on storage.objects;
create policy "External driver uploads documents for assigned orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-documents'
    and public.is_my_external_order((storage.foldername(name))[1], false)
  );

drop policy if exists "External driver reads documents of assigned orders" on storage.objects;
create policy "External driver reads documents of assigned orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and public.is_my_external_order((storage.foldername(name))[1], false)
  );

drop policy if exists "External driver deletes documents of open assigned orders" on storage.objects;
create policy "External driver deletes documents of open assigned orders"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-documents'
    and public.is_my_external_order((storage.foldername(name))[1], true)
  );

-- Anders als bei den eigenen Aufträgen sieht der Chef die Belege sofort und
-- nicht erst nach "erledigt": Vergisst der fremde Fahrer das Abschließen
-- und wird sein Zugang danach gelöscht, bekäme der Chef die Belege sonst
-- nie zu Gesicht.
drop policy if exists "Boss reads documents of external orders" on storage.objects;
create policy "Boss reads documents of external orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (select public.app_role()) = 'boss'
    and exists (
      select 1
        from public.external_orders e
       where e.id::text = (storage.foldername(name))[1]
    )
  );

-- --- 9. Vor dem Löschen eines Zugangs ---------------------------------------
-- Supabase: "You cannot delete a user if they are the owner of any objects
-- in Supabase Storage." Die hochgeladenen Belege sollen aber bleiben — sie
-- gehören zum Auftrag, nicht zum Konto. Also wird vorher nur der Besitz
-- freigegeben. Aufgerufen ausschließlich aus der Edge Function
-- delete-external-driver.
create or replace function public.release_storage_ownership(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update storage.objects
     set owner = null,
         owner_id = null
   where owner_id = uid::text
      or owner = uid;
$$;

revoke all on function public.release_storage_ownership(uuid) from public;
revoke all on function public.release_storage_ownership(uuid) from anon;
revoke all on function public.release_storage_ownership(uuid) from authenticated;
grant execute on function public.release_storage_ownership(uuid) to service_role;

notify pgrst, 'reload schema';
