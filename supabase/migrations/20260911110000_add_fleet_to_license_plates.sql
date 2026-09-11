-- Aus der reinen Kennzeichenliste wird der Fahrzeugstamm: die Übersicht
-- der eigenen LKW im Chef-Dashboard (app/chef/vehicles/index.tsx). Der
-- Chef trägt dort einen LKW ein und sieht je Fahrzeug den aktuellen
-- Kilometerstand.
--
-- Die Tabelle behält ihren Namen. Sie steht schon hinter dem
-- Kennzeichen-Dropdown bei der Fahrerverwaltung
-- (20260911100000_create_license_plates.sql), und ein zweiter
-- Fahrzeugstamm daneben hieße: zwei Listen, die auseinanderlaufen.
--
-- Den Kilometerstand tippt der Chef NICHT ein — er kommt aus der
-- Tankliste des Fahrers. Der Fahrer notiert ihn ohnehin bei jeder
-- Tankung; ihn ein zweites Mal von Hand zu pflegen wäre genau die
-- doppelte Arbeit, die die App abschaffen soll.

-- ---------------------------------------------------------------- Spalten
alter table public.license_plates
  add column if not exists km_stand integer,
  add column if not exists km_entry_date date,
  add column if not exists km_updated_at timestamptz;

-- Derselbe normalisierte Schlüssel wie in tank_entries.license_plate_key
-- (siehe 20260909100000_create_tank_entries.sql). Nur darüber lassen sich
-- die handgetippten Kennzeichen der Fahrer verlässlich dem Fahrzeug
-- zuordnen: "GR400FX", "gr400fx" und "GR 400 FX" sind derselbe LKW.
alter table public.license_plates
  add column if not exists plate_key text
  generated always as (upper(regexp_replace(name, '\s+', '', 'g'))) stored;

create index if not exists license_plates_plate_key_idx
  on public.license_plates (plate_key);

-- ---------------------------------------------------------------- Trigger
-- Zieht den Kilometerstand bei jeder neuen Tankung nach.
--
-- security definer, weil der Fahrer diese Tabelle selbst nicht schreiben
-- darf (die Policies gehören dem Chef) — der Trigger läuft trotzdem, und
-- zwar nur mit genau dieser einen, fest verdrahteten Anweisung.
--
-- greatest(): Ein Kilometerstand geht nie zurück. Trägt ein Fahrer eine
-- Tankung nach, die älter ist als die letzte, darf sie den Stand am
-- Fahrzeug nicht nach unten ziehen. Korrigieren kann der Fahrer seine
-- Einträge ohnehin nicht (bewusst keine UPDATE-Policy auf tank_entries).
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

  -- Hat der Fahrer ein Kennzeichen getippt, das der Chef nie eingetragen
  -- hat, entsteht das Fahrzeug hier. Besser als es zu verschlucken: So
  -- fällt dem Chef in der Übersicht auf, dass ein LKW fehlt — oder dass
  -- sich jemand vertippt hat.
  if not found then
    insert into public.license_plates (name, km_stand, km_entry_date, km_updated_at)
    values (upper(btrim(new.license_plate)), new.km_stand, new.entry_date, now())
    on conflict (name) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists tank_entries_sync_license_plate_km on public.tank_entries;

create trigger tank_entries_sync_license_plate_km
  after insert on public.tank_entries
  for each row
  execute function public.sync_license_plate_km();

-- --------------------------------------------------------------- Nachtrag
-- Die Tankliste gibt es schon länger als diese Spalten. Ohne diesen
-- Nachtrag stünde die Übersicht bis zur jeweils nächsten Tankung leer.
update public.license_plates lp
   set km_stand = sub.km_stand,
       km_entry_date = sub.entry_date,
       km_updated_at = now()
  from (
    select distinct on (license_plate_key)
           license_plate_key, km_stand, entry_date
      from public.tank_entries
     order by license_plate_key, km_stand desc, entry_date desc
  ) sub
 where lp.plate_key = sub.license_plate_key;

insert into public.license_plates (name, km_stand, km_entry_date, km_updated_at)
select distinct on (t.license_plate_key)
       upper(btrim(t.license_plate)), t.km_stand, t.entry_date, now()
  from public.tank_entries t
 where not exists (
   select 1 from public.license_plates lp where lp.plate_key = t.license_plate_key
 )
 order by t.license_plate_key, t.km_stand desc, t.entry_date desc
on conflict (name) do nothing;

notify pgrst, 'reload schema';
