-- Bestätigung des Transportauftrags durch den Frächter, mit Rücktrittsfrist.
--
-- Früher stand auf Seite 3 des Transportauftrags "Bitte bestätigen und
-- innerhalb einer Stunde zurückschicken" samt Tabelle zum Unterschreiben.
-- Jetzt bestätigt der fremde Fahrer den Auftrag in seiner App:
--
--   * Bestätigen geht nur mit eingetragenem Kennzeichen und Fahrernamen.
--   * Danach kann er eine Stunde lang zurücktreten. Gemessen wird mit der
--     Uhr der Datenbank, nicht der des Handys. Nach der Stunde ist der
--     Auftrag verbindlich.
--   * Tritt er zurück, verliert er die Zuweisung automatisch; der Auftrag ist
--     wieder frei, und der Chef bekommt eine Erinnerung.
--   * Frächter ohne App-Zugang bestätigen telefonisch oder per Mail; das
--     trägt der Chef ein (confirmed_via = 'boss') und kann es auch wieder
--     zurücknehmen.
--
-- Jede Bestätigung und jeder Rücktritt landet zusätzlich im Protokoll
-- external_order_confirmation_log — der Nachweis, falls es Streit gibt.
-- Das Protokoll bleibt, auch wenn der Zugang später gelöscht wird.
--
-- Die Spalten setzen nur die Funktionen unten. Der Chef hat zwar eine
-- update-Policy auf external_orders; ein Trigger verhindert aber, dass
-- darüber Bestätigungen gefälscht oder gelöscht werden.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Spalten ---------------------------------------------------------------
alter table public.external_orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_via text,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by_label text;

alter table public.external_orders
  drop constraint if exists external_orders_confirmed_via_check;

alter table public.external_orders
  add constraint external_orders_confirmed_via_check
  check (confirmed_via is null or confirmed_via in ('app', 'boss'));

-- --- 2. Protokoll ---------------------------------------------------------------
create table if not exists public.external_order_confirmation_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.external_orders(id) on delete cascade,
  event text not null check (event in ('confirmed', 'withdrawn', 'confirmed_by_boss', 'reset_by_boss')),
  at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  -- Name des Zugangs bzw. "Chef", als Text: bleibt lesbar, wenn das Konto weg ist.
  user_label text not null default '',
  license_plate text not null default '',
  driver_name text not null default ''
);

create index if not exists external_order_confirmation_log_order_idx
  on public.external_order_confirmation_log (order_id, at);

alter table public.external_order_confirmation_log enable row level security;

-- Lesen darf nur der Chef. Schreiben niemand direkt, nur die Funktionen.
drop policy if exists "Boss can read confirmation log" on public.external_order_confirmation_log;
create policy "Boss can read confirmation log"
  on public.external_order_confirmation_log for select
  to authenticated
  using ((select public.app_role()) = 'boss');

-- --- 3. Schutz der Spalten ------------------------------------------------------
-- Nur die Funktionen unten setzen app.order_confirmation = 'on'. Bei jedem
-- anderen Schreiben bleiben die Bestätigungsspalten, wie sie waren.
--
-- Weist der Chef den Auftrag einem anderen Zugang zu (oder hebt die
-- Zuweisung auf), gilt eine Bestätigung aus der App nicht mehr — sie kam vom
-- bisherigen Frächter. Eine vom Chef eingetragene bleibt. Eine neue
-- Zuweisung löscht außerdem den Rücktrittsvermerk: Der Auftrag ist wieder
-- vergeben.
create or replace function public.protect_external_order_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.order_confirmation', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.confirmed_at := null;
    new.confirmed_by := null;
    new.confirmed_via := null;
    new.withdrawn_at := null;
    new.withdrawn_by_label := null;
    return new;
  end if;

  new.confirmed_at := old.confirmed_at;
  new.confirmed_by := old.confirmed_by;
  new.confirmed_via := old.confirmed_via;
  new.withdrawn_at := old.withdrawn_at;
  new.withdrawn_by_label := old.withdrawn_by_label;

  if new.assigned_external_user_id is distinct from old.assigned_external_user_id then
    if old.confirmed_via = 'app' then
      new.confirmed_at := null;
      new.confirmed_by := null;
      new.confirmed_via := null;
    end if;
    if new.assigned_external_user_id is not null then
      new.withdrawn_at := null;
      new.withdrawn_by_label := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists external_orders_protect_confirmation on public.external_orders;

create trigger external_orders_protect_confirmation
  before insert or update on public.external_orders
  for each row
  execute function public.protect_external_order_confirmation();

-- --- 4. Fremder Fahrer: bestätigen ---------------------------------------------
-- Feste Kennungen statt Text, die App übersetzt sie:
--   EXT_CONFIRM_NOT_ALLOWED     nicht zugewiesen, erledigt oder Zugang abgelaufen
--   EXT_CONFIRM_DRIVER_MISSING  Kennzeichen oder Fahrername fehlt
--   EXT_CONFIRM_ALREADY         schon bestätigt
create or replace function public.confirm_external_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.external_orders%rowtype;
  v_label text;
begin
  if not public.has_active_external_access() then
    raise exception 'EXT_CONFIRM_NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  select * into v
    from public.external_orders e
   where e.id = confirm_external_order.order_id
     and e.assigned_external_user_id = auth.uid()
     and e.status <> 'completed'
   for update;

  if not found then
    raise exception 'EXT_CONFIRM_NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  if v.confirmed_at is not null then
    raise exception 'EXT_CONFIRM_ALREADY' using errcode = 'check_violation';
  end if;

  if coalesce(btrim(v.license_plate), '') = '' or coalesce(btrim(v.driver_name), '') = '' then
    raise exception 'EXT_CONFIRM_DRIVER_MISSING' using errcode = 'check_violation';
  end if;

  select a.label into v_label
    from public.external_driver_accounts a
   where a.user_id = auth.uid();

  perform set_config('app.order_confirmation', 'on', true);

  update public.external_orders e
     set confirmed_at = now(),
         confirmed_by = auth.uid(),
         confirmed_via = 'app',
         withdrawn_at = null,
         withdrawn_by_label = null,
         updated_at = now()
   where e.id = v.id;

  insert into public.external_order_confirmation_log
    (order_id, event, user_id, user_label, license_plate, driver_name)
  values
    (v.id, 'confirmed', auth.uid(), coalesce(v_label, ''), btrim(v.license_plate), btrim(v.driver_name));

  perform set_config('app.order_confirmation', 'off', true);
end;
$$;

-- --- 5. Fremder Fahrer: zurücktreten (nur innerhalb einer Stunde) -------------
--   EXT_WITHDRAW_NOT_ALLOWED  nicht zugewiesen, nicht von ihm bestätigt, erledigt
--   EXT_WITHDRAW_EXPIRED      die Stunde ist vorbei, der Auftrag ist verbindlich
create or replace function public.withdraw_external_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.external_orders%rowtype;
  v_label text;
begin
  if not public.has_active_external_access() then
    raise exception 'EXT_WITHDRAW_NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  select * into v
    from public.external_orders e
   where e.id = withdraw_external_order.order_id
     and e.assigned_external_user_id = auth.uid()
     and e.status <> 'completed'
   for update;

  if not found or v.confirmed_via is distinct from 'app' or v.confirmed_by is distinct from auth.uid() then
    raise exception 'EXT_WITHDRAW_NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  if now() > v.confirmed_at + interval '1 hour' then
    raise exception 'EXT_WITHDRAW_EXPIRED' using errcode = 'check_violation';
  end if;

  select a.label into v_label
    from public.external_driver_accounts a
   where a.user_id = auth.uid();

  perform set_config('app.order_confirmation', 'on', true);

  -- Zuweisung weg, Kennzeichen und Fahrer weg: Das waren seine. Der nächste
  -- Frächter trägt seine eigenen ein.
  update public.external_orders e
     set confirmed_at = null,
         confirmed_by = null,
         confirmed_via = null,
         withdrawn_at = now(),
         withdrawn_by_label = coalesce(v_label, ''),
         assigned_external_user_id = null,
         license_plate = '',
         driver_name = '',
         updated_at = now()
   where e.id = v.id;

  insert into public.external_order_confirmation_log
    (order_id, event, user_id, user_label, license_plate, driver_name)
  values
    (v.id, 'withdrawn', auth.uid(), coalesce(v_label, ''),
     coalesce(btrim(v.license_plate), ''), coalesce(btrim(v.driver_name), ''));

  perform set_config('app.order_confirmation', 'off', true);
end;
$$;

-- --- 6. Chef: telefonische Bestätigung eintragen und zurücknehmen -------------
create or replace function public.boss_confirm_external_order(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.external_orders%rowtype;
begin
  if coalesce(public.app_role(), '') <> 'boss' then
    raise exception 'Nur der Chef kann das eintragen' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.external_orders e
   where e.id = boss_confirm_external_order.order_id
   for update;

  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'no_data_found';
  end if;

  if v.confirmed_at is not null then
    raise exception 'EXT_CONFIRM_ALREADY' using errcode = 'check_violation';
  end if;

  perform set_config('app.order_confirmation', 'on', true);

  update public.external_orders e
     set confirmed_at = now(),
         confirmed_by = auth.uid(),
         confirmed_via = 'boss',
         withdrawn_at = null,
         withdrawn_by_label = null,
         updated_at = now()
   where e.id = v.id;

  insert into public.external_order_confirmation_log
    (order_id, event, user_id, user_label, license_plate, driver_name)
  values
    (v.id, 'confirmed_by_boss', auth.uid(), 'Chef',
     coalesce(btrim(v.license_plate), ''), coalesce(btrim(v.driver_name), ''));

  perform set_config('app.order_confirmation', 'off', true);
end;
$$;

-- Nur eine vom Chef eingetragene Bestätigung lässt sich zurücknehmen (etwa
-- ein Fehlklick). Eine aus der App ist der Nachweis des Frächters; will der
-- Chef ihn freigeben, hebt er die Zuweisung auf.
create or replace function public.boss_reset_external_order_confirmation(order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.external_orders%rowtype;
begin
  if coalesce(public.app_role(), '') <> 'boss' then
    raise exception 'Nur der Chef kann das zurücknehmen' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.external_orders e
   where e.id = boss_reset_external_order_confirmation.order_id
   for update;

  if not found or v.confirmed_via is distinct from 'boss' then
    raise exception 'EXT_RESET_NOT_ALLOWED' using errcode = 'check_violation';
  end if;

  perform set_config('app.order_confirmation', 'on', true);

  update public.external_orders e
     set confirmed_at = null,
         confirmed_by = null,
         confirmed_via = null,
         updated_at = now()
   where e.id = v.id;

  insert into public.external_order_confirmation_log (order_id, event, user_id, user_label)
  values (v.id, 'reset_by_boss', auth.uid(), 'Chef');

  perform set_config('app.order_confirmation', 'off', true);
end;
$$;

revoke all on function public.confirm_external_order(uuid) from public;
revoke all on function public.confirm_external_order(uuid) from anon;
grant execute on function public.confirm_external_order(uuid) to authenticated;

revoke all on function public.withdraw_external_order(uuid) from public;
revoke all on function public.withdraw_external_order(uuid) from anon;
grant execute on function public.withdraw_external_order(uuid) to authenticated;

revoke all on function public.boss_confirm_external_order(uuid) from public;
revoke all on function public.boss_confirm_external_order(uuid) from anon;
grant execute on function public.boss_confirm_external_order(uuid) to authenticated;

revoke all on function public.boss_reset_external_order_confirmation(uuid) from public;
revoke all on function public.boss_reset_external_order_confirmation(uuid) from anon;
grant execute on function public.boss_reset_external_order_confirmation(uuid) to authenticated;

-- --- 7. Aufträge für den fremden Fahrer, jetzt mit Bestätigung -----------------
-- Wie in 20260915130000_external_driver_access.sql, plus confirmed_at und
-- confirmed_via. Weiterhin ohne Preise. Neue Spalten im Ergebnis ändern die
-- Signatur, deshalb erst löschen.
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
  driver_name text,
  confirmed_at timestamptz,
  confirmed_via text
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
         e.vehicle_type, e.notes, e.license_plate, e.driver_name,
         e.confirmed_at, e.confirmed_via
    from public.external_orders e
   where e.assigned_external_user_id = auth.uid()
     and public.has_active_external_access()
   order by e.loading_date nulls last, e.created_at;
$$;

revoke all on function public.get_my_external_orders() from public;
revoke all on function public.get_my_external_orders() from anon;
grant execute on function public.get_my_external_orders() to authenticated;

notify pgrst, 'reload schema';
