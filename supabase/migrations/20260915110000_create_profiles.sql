-- Rollen in einer eigenen Tabelle statt im user_metadata.
--
-- Bisher stand die Rolle ("boss"/"driver") im user_metadata des Kontos, und
-- jede Policy las sie aus dem JWT. Das user_metadata kann aber jeder
-- angemeldete Nutzer selbst ändern:
--
--   supabase.auth.updateUser({ data: { role: 'boss' } })
--
-- Nach dem nächsten Token-Refresh steht dann 'boss' im JWT, und jede Policy
-- hält den Fahrer für den Chef. Die Supabase-Doku warnt ausdrücklich davor,
-- user_metadata für Berechtigungen zu verwenden. Mit den Zugängen für
-- fremde Fahrer (20260915130000) wäre diese Lücke auch Leuten außerhalb der
-- Firma offen gestanden.
--
-- public.profiles darf kein Client schreiben — es gibt dafür keine
-- insert-/update-/delete-Policy. Rollen vergeben nur die Edge Functions
-- (service_role) oder jemand im Supabase-Dashboard.
--
-- Nebeneffekt: Eine geänderte Rolle wirkt sofort, niemand muss sich dafür
-- neu anmelden.
--
-- WICHTIG: Ein Chef-Konto, das künftig von Hand im Dashboard angelegt wird,
-- braucht eine Zeile in dieser Tabelle, sonst kommt es nicht mehr hinein:
--
--   insert into public.profiles (id, role) values ('<user-id>', 'boss');
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Tabelle -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('boss', 'driver', 'external_driver')),
  created_at timestamptz not null default now()
);

-- Die bestehenden Konten übernehmen. Wer schon eine Zeile hat, behält sie —
-- ein zweiter Durchlauf überschreibt keine inzwischen geänderte Rolle.
insert into public.profiles (id, role)
select id, raw_user_meta_data ->> 'role'
  from auth.users
 where raw_user_meta_data ->> 'role' in ('boss', 'driver')
on conflict (id) do nothing;

-- --- 2. Rolle des aufrufenden Nutzers ---------------------------------------
-- security definer, damit eine Policy auf profiles selbst diese Funktion
-- aufrufen kann, ohne dass RLS sich im Kreis prüft.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.app_role() from public;
revoke all on function public.app_role() from anon;
grant execute on function public.app_role() to authenticated;

-- --- 3. Rechte auf profiles --------------------------------------------------
-- Überall unten steht (select public.app_role()) statt public.app_role():
-- So wertet Postgres die Funktion einmal je Abfrage aus und nicht für jede
-- einzelne Zeile.
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile, boss reads all" on public.profiles;
create policy "Users read own profile, boss reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or (select public.app_role()) = 'boss');

-- --- 4. Bestehende Policies umstellen ---------------------------------------
-- Jede Policy, die bisher das JWT-user_metadata gelesen hat, wird mit
-- demselben Namen und derselben Bedeutung neu angelegt.

-- carrier_companies
drop policy if exists "Boss can read carrier companies" on public.carrier_companies;
create policy "Boss can read carrier companies"
  on public.carrier_companies for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add carrier companies" on public.carrier_companies;
create policy "Boss can add carrier companies"
  on public.carrier_companies for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can update carrier companies" on public.carrier_companies;
create policy "Boss can update carrier companies"
  on public.carrier_companies for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- site_companies
drop policy if exists "Boss can read site companies" on public.site_companies;
create policy "Boss can read site companies"
  on public.site_companies for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add site companies" on public.site_companies;
create policy "Boss can add site companies"
  on public.site_companies for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

-- unloading_companies
drop policy if exists "Boss can read unloading companies" on public.unloading_companies;
create policy "Boss can read unloading companies"
  on public.unloading_companies for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add unloading companies" on public.unloading_companies;
create policy "Boss can add unloading companies"
  on public.unloading_companies for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

-- external_orders
drop policy if exists "Boss can read external orders" on public.external_orders;
create policy "Boss can read external orders"
  on public.external_orders for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can create external orders" on public.external_orders;
create policy "Boss can create external orders"
  on public.external_orders for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can edit external orders" on public.external_orders;
create policy "Boss can edit external orders"
  on public.external_orders for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- orders
drop policy if exists "Boss can read all orders" on public.orders;
create policy "Boss can read all orders"
  on public.orders for select
  to authenticated
  using ((select public.app_role()) = 'boss');

-- Neu: zusätzlich die Rolle. assigned_to allein würde reichen, solange
-- nur Fahrer zugewiesen werden — die Rolle hält das auch dann dicht, wenn
-- jemand versehentlich einen fremden Zugang einträgt.
drop policy if exists "Driver can read own assigned orders" on public.orders;
create policy "Driver can read own assigned orders"
  on public.orders for select
  to authenticated
  using (assigned_to = auth.uid() and (select public.app_role()) = 'driver');

drop policy if exists "Boss can create orders" on public.orders;
create policy "Boss can create orders"
  on public.orders for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can edit orders" on public.orders;
create policy "Boss can edit orders"
  on public.orders for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- tank_entries
drop policy if exists "Boss can read all tank entries" on public.tank_entries;
create policy "Boss can read all tank entries"
  on public.tank_entries for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Driver can read own tank entries" on public.tank_entries;
create policy "Driver can read own tank entries"
  on public.tank_entries for select
  to authenticated
  using (driver_id = auth.uid() and (select public.app_role()) = 'driver');

-- Neu: nur Fahrer. Bisher prüfte die Policy allein driver_id = auth.uid(),
-- damit hätte jedes Konto — auch ein fremder Fahrer — Tankungen auf seinen
-- eigenen Namen eintragen können, und über den Trigger
-- sync_license_plate_km sogar Fahrzeuge in der Flotte anlegen.
drop policy if exists "Driver can create own tank entries" on public.tank_entries;
create policy "Driver can create own tank entries"
  on public.tank_entries for insert
  to authenticated
  with check (driver_id = auth.uid() and (select public.app_role()) = 'driver');

-- invoices
drop policy if exists "Boss can read invoices" on public.invoices;
create policy "Boss can read invoices"
  on public.invoices for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can edit invoices" on public.invoices;
create policy "Boss can edit invoices"
  on public.invoices for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- invoice_items
drop policy if exists "Boss can read invoice items" on public.invoice_items;
create policy "Boss can read invoice items"
  on public.invoice_items for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can edit invoice items" on public.invoice_items;
create policy "Boss can edit invoice items"
  on public.invoice_items for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- license_plates
drop policy if exists "Boss can read license plates" on public.license_plates;
create policy "Boss can read license plates"
  on public.license_plates for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add license plates" on public.license_plates;
create policy "Boss can add license plates"
  on public.license_plates for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can update license plates" on public.license_plates;
create policy "Boss can update license plates"
  on public.license_plates for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

-- Storage: CMR und Fotos der eigenen Aufträge (20260908120000_order_documents.sql)
drop policy if exists "Driver uploads documents for own orders" on storage.objects;
create policy "Driver uploads documents for own orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-documents'
    and (select public.app_role()) = 'driver'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
    )
  );

drop policy if exists "Driver reads documents of own orders" on storage.objects;
create policy "Driver reads documents of own orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (select public.app_role()) = 'driver'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
    )
  );

drop policy if exists "Driver deletes documents of open own orders" on storage.objects;
create policy "Driver deletes documents of open own orders"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (select public.app_role()) = 'driver'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
         and o.status <> 'completed'
    )
  );

drop policy if exists "Boss reads documents of completed orders" on storage.objects;
create policy "Boss reads documents of completed orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (select public.app_role()) = 'boss'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.status = 'completed'
    )
  );

-- --- 5. Funktionen mit eigener Rollenprüfung --------------------------------
-- Unverändert bis auf die Zeile mit der Rollenprüfung
-- (20260914110000_add_prices_to_tank_entries.sql).
create or replace function public.set_tank_entry_prices(
  entry_id uuid,
  price_adblue numeric,
  price_per_liter numeric,
  price_total numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.app_role(), '') <> 'boss' then
    raise exception 'Nur der Chef kann Preise eintragen'
      using errcode = 'insufficient_privilege';
  end if;

  update public.tank_entries
     set -- Ohne nachgefülltes AdBlue gibt es auch keinen AdBlue-Preis; ein
         -- versehentlich mitgeschickter Wert wird verworfen.
         price_adblue = case
           when liters_adblue is null then null
           else set_tank_entry_prices.price_adblue
         end,
         price_per_liter = set_tank_entry_prices.price_per_liter,
         price_total = set_tank_entry_prices.price_total
   where id = entry_id;

  if not found then
    raise exception 'Tankeintrag nicht gefunden'
      using errcode = 'no_data_found';
  end if;
end;
$$;

-- Unverändert bis auf die Zeile mit der Rollenprüfung
-- (20260915100000_boss_can_edit_tank_entries.sql).
create or replace function public.update_tank_entry(
  entry_id uuid,
  entry_date date,
  license_plate text,
  km_stand integer,
  liters_diesel numeric,
  liters_adblue numeric,
  fuel_station text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_key text;
  new_key text;
begin
  if coalesce(public.app_role(), '') <> 'boss' then
    raise exception 'Nur der Chef kann Tankeinträge ändern'
      using errcode = 'insufficient_privilege';
  end if;

  select t.license_plate_key into old_key
    from public.tank_entries t
   where t.id = entry_id;

  if not found then
    raise exception 'Tankeintrag nicht gefunden'
      using errcode = 'no_data_found';
  end if;

  update public.tank_entries t
     set entry_date = update_tank_entry.entry_date,
         license_plate = btrim(update_tank_entry.license_plate),
         km_stand = update_tank_entry.km_stand,
         liters_diesel = update_tank_entry.liters_diesel,
         liters_adblue = update_tank_entry.liters_adblue,
         fuel_station = btrim(coalesce(update_tank_entry.fuel_station, '')),
         price_adblue = case
           when update_tank_entry.liters_adblue is null then null
           else t.price_adblue
         end
   where t.id = entry_id
  returning t.license_plate_key into new_key;

  -- Neues Kennzeichen, das es als Fahrzeug noch nicht gibt: anlegen wie der
  -- Trigger sync_license_plate_km beim Erfassen
  -- (20260911110000_add_fleet_to_license_plates.sql).
  if new_key <> old_key and not exists (
    select 1 from public.license_plates lp where lp.plate_key = new_key
  ) then
    insert into public.license_plates (name, km_stand, km_entry_date, km_updated_at)
    values (
      upper(btrim(update_tank_entry.license_plate)),
      update_tank_entry.km_stand,
      update_tank_entry.entry_date,
      now()
    )
    on conflict (name) do nothing;
  end if;

  -- Kilometerstand am Fahrzeug neu aus den Tankungen bestimmen (siehe
  -- 20260915100000_boss_can_edit_tank_entries.sql).
  update public.license_plates lp
     set km_stand = sub.km_stand,
         km_entry_date = sub.entry_date,
         km_updated_at = now()
    from (
      select distinct on (te.license_plate_key)
             te.license_plate_key, te.km_stand, te.entry_date
        from public.tank_entries te
       where te.license_plate_key in (old_key, new_key)
       order by te.license_plate_key, te.km_stand desc, te.entry_date desc
    ) sub
   where lp.plate_key = sub.license_plate_key;
end;
$$;

-- --- 6. Kontrolle ------------------------------------------------------------
-- Das Repository bildet die Datenbank nicht vollständig ab. Steht irgendwo
-- noch eine Policy, die das user_metadata liest, oder ein Konto ohne Rolle,
-- meldet der SQL Editor das hier als Hinweis — die Migration läuft trotzdem
-- durch.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where coalesce(qual, '') ilike '%user_metadata%'
        or coalesce(with_check, '') ilike '%user_metadata%'
  loop
    raise warning 'Policy liest noch user_metadata: %.% — "%"',
      r.schemaname, r.tablename, r.policyname;
  end loop;

  for r in
    select u.id, u.email
      from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    raise warning 'Konto ohne Rolle in public.profiles (kommt nicht mehr hinein): % (%)',
      r.email, r.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
