-- Die Datenbank prüft neue Tankungen auf Plausibilität.
--
-- Bisher konnte ein Fahrer jedes Kennzeichen und jeden km-Stand eintragen.
-- Unbekannte Kennzeichen wurden als neuer LKW angelegt, und ein km-Sprung blieb
-- wegen greatest() dauerhaft am Fahrzeug stehen.
--
-- Abgelehnt werden jetzt:
--   TANK_UNKNOWN_PLATE  Kennzeichen, das nicht als aktiver LKW im Fuhrpark steht
--   TANK_KM_JUMP        km-Stand mehr als 10.000 km über dem letzten Stand
--   TANK_FUTURE_DATE    Datum nach morgen (morgen wegen der Zeitzone erlaubt)
--
-- Die App übersetzt diese Kennungen in verständliche Meldungen. Bestehende
-- Einträge bleiben unberührt, und der Chef korrigiert weiter über
-- update_tank_entry.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

create or replace function public.check_tank_entry_plausibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_km integer;
  v_key text;
begin
  if new.entry_date > current_date + 1 then
    raise exception 'TANK_FUTURE_DATE' using errcode = 'check_violation';
  end if;

  -- Selbst berechnet: Generierte Spalten wie license_plate_key sind in einem
  -- before-Trigger noch leer.
  v_key := upper(regexp_replace(new.license_plate, '\s+', '', 'g'));

  -- Die Sperre hält zwei gleichzeitige Tankungen desselben LKW auseinander.
  select lp.km_stand
    into v_km
    from public.license_plates lp
   where lp.plate_key = v_key
     and lp.retired_at is null
   order by lp.km_stand desc nulls last
   limit 1
   for update;

  if not found then
    raise exception 'TANK_UNKNOWN_PLATE' using errcode = 'check_violation';
  end if;

  -- bigint, damit die Summe bei einem kaputten Altwert nicht überläuft.
  if v_km is not null and new.km_stand::bigint > v_km::bigint + 10000 then
    raise exception 'TANK_KM_JUMP' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists tank_entries_check_plausibility on public.tank_entries;

create trigger tank_entries_check_plausibility
  before insert on public.tank_entries
  for each row
  execute function public.check_tank_entry_plausibility();

-- Zieht den km-Stand nach. Fahrzeuge legt nur noch der Chef an.
create or replace function public.sync_license_plate_km()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.license_plates
     set km_entry_date = case
           when new.km_stand >= coalesce(km_stand, 0) then new.entry_date
           else km_entry_date
         end,
         km_stand = greatest(coalesce(km_stand, 0), new.km_stand),
         km_updated_at = now()
   where plate_key = new.license_plate_key;

  return new;
end;
$$;

notify pgrst, 'reload schema';
