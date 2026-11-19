-- Fahrer dürfen eigene Tankungen drei Tage lang ändern, der Chef darf
-- Tankungen löschen.
--
-- Bisher war die Tankliste für den Fahrer ein reines Fahrtenbuch: einmal
-- gespeichert, nie mehr änderbar (20260909100000_create_tank_entries.sql).
-- Ein Tippfehler musste über den Chef laufen. Jetzt kann der Fahrer seine
-- eigene Tankung bis drei Tage nach dem Erfassen selbst korrigieren.
-- Maßgeblich ist created_at, also wann er sie eingetragen hat, nicht das
-- Tankdatum: Sonst wäre eine nachgetragene Tankung von letzter Woche sofort
-- gesperrt.
--
-- Weiterhin keine UPDATE-/DELETE-Policy, sondern Funktionen: RLS prüft
-- Zeilen, keine Spalten. Eine UPDATE-Policy für den Fahrer ließe ihn auch die
-- Preise des Chefs und driver_id ändern.
--
-- Für den Fahrer gelten beim Ändern dieselben Prüfungen wie beim Erfassen
-- (20261119120000_tank_entry_plausibility.sql), mit denselben Kennungen.
-- Neu:
--   TANK_EDIT_NOT_ALLOWED  nicht die eigene Tankung (oder gibt es nicht)
--   TANK_EDIT_EXPIRED      mehr als drei Tage seit dem Erfassen
--
-- Der Chef ändert wie bisher ohne Frist und darf als Einziger löschen.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Ändern: Chef immer, Fahrer drei Tage lang -----------------------------
-- Signatur unverändert, deshalb ersetzt das die Fassung aus
-- 20260915110000_create_profiles.sql ohne zweite Überladung.
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
  v_role text := coalesce(public.app_role(), '');
  v_driver uuid;
  v_created timestamptz;
  v_km integer;
  old_key text;
  new_key text;
begin
  if v_role not in ('boss', 'driver') then
    raise exception 'Nur der Chef kann Tankeinträge ändern'
      using errcode = 'insufficient_privilege';
  end if;

  -- for update: Zwei gleichzeitige Änderungen derselben Tankung laufen
  -- nacheinander, nicht verschränkt.
  select t.license_plate_key, t.driver_id, t.created_at
    into old_key, v_driver, v_created
    from public.tank_entries t
   where t.id = entry_id
   for update;

  if v_role = 'driver' then
    -- Fremde und nicht vorhandene Tankung melden dasselbe, damit ein Fahrer
    -- nicht ausprobieren kann, welche IDs es gibt.
    if not found or v_driver is distinct from auth.uid() then
      raise exception 'TANK_EDIT_NOT_ALLOWED' using errcode = 'insufficient_privilege';
    end if;

    if v_created < now() - interval '3 days' then
      raise exception 'TANK_EDIT_EXPIRED' using errcode = 'check_violation';
    end if;

    -- Dieselben Regeln wie check_tank_entry_plausibility beim Erfassen.
    if update_tank_entry.entry_date > current_date + 1 then
      raise exception 'TANK_FUTURE_DATE' using errcode = 'check_violation';
    end if;

    new_key := upper(regexp_replace(update_tank_entry.license_plate, '\s+', '', 'g'));

    select lp.km_stand
      into v_km
      from public.license_plates lp
     where lp.plate_key = new_key
       and lp.retired_at is null
     order by lp.km_stand desc nulls last
     limit 1
     for update;

    if not found then
      raise exception 'TANK_UNKNOWN_PLATE' using errcode = 'check_violation';
    end if;

    if v_km is not null
       and update_tank_entry.km_stand::bigint > v_km::bigint + 10000 then
      raise exception 'TANK_KM_JUMP' using errcode = 'check_violation';
    end if;
  elsif not found then
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

  -- Neues Kennzeichen, das es als Fahrzeug noch nicht gibt: Das darf nur der
  -- Chef, beim Fahrer hat TANK_UNKNOWN_PLATE oben schon abgelehnt.
  if v_role = 'boss' and new_key <> old_key and not exists (
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

revoke all on function public.update_tank_entry(uuid, date, text, integer, numeric, numeric, text) from public;
revoke all on function public.update_tank_entry(uuid, date, text, integer, numeric, numeric, text) from anon;
grant execute on function public.update_tank_entry(uuid, date, text, integer, numeric, numeric, text) to authenticated;

-- --- 2. Löschen: nur der Chef, ohne Frist -------------------------------------
-- Eine Funktion statt einer DELETE-Policy, damit der km-Stand am LKW
-- mitläuft: Stammte der höchste Stand aus der gelöschten Tankung (etwa ein
-- Tippfehler 343890 statt 34389), bliebe er sonst für immer am Fahrzeug.
create or replace function public.delete_tank_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_key text;
begin
  if coalesce(public.app_role(), '') <> 'boss' then
    raise exception 'Nur der Chef kann Tankeinträge löschen'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.tank_entries t
   where t.id = entry_id
  returning t.license_plate_key into old_key;

  if not found then
    raise exception 'Tankeintrag nicht gefunden'
      using errcode = 'no_data_found';
  end if;

  -- Wie in update_tank_entry: höchster Stand der übrigen Tankungen. Bleibt
  -- keine übrig, behält das Fahrzeug seinen Stand.
  update public.license_plates lp
     set km_stand = sub.km_stand,
         km_entry_date = sub.entry_date,
         km_updated_at = now()
    from (
      select te.km_stand, te.entry_date
        from public.tank_entries te
       where te.license_plate_key = old_key
       order by te.km_stand desc, te.entry_date desc
       limit 1
    ) sub
   where lp.plate_key = old_key;
end;
$$;

revoke all on function public.delete_tank_entry(uuid) from public;
revoke all on function public.delete_tank_entry(uuid) from anon;
grant execute on function public.delete_tank_entry(uuid) to authenticated;

notify pgrst, 'reload schema';
