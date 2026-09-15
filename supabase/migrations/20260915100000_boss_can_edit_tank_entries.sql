-- Der Chef korrigiert die Angaben des Fahrers in der Tankliste.
--
-- Bisher liefen Korrekturen direkt in Supabase (siehe
-- 20260909100000_create_tank_entries.sql). Jetzt kann der Chef einen
-- Tippfehler — falscher km-Stand, vertauschte Liter, falsches Kennzeichen —
-- in der App berichtigen. Er muss es nicht: Die Eingabe des Fahrers bleibt
-- gültig, solange niemand etwas ändert.
--
-- Wie bei den Preisen (20260914110000_add_prices_to_tank_entries.sql) über
-- eine Funktion statt einer UPDATE-Policy: RLS prüft Zeilen, keine Spalten —
-- eine Policy gäbe dem Chef ein freies UPDATE auf die ganze Zeile, und der
-- Kilometerstand am Fahrzeug liefe nicht mit. Die Funktion prüft die Rolle
-- selbst, ändert genau die Felder vom Zettel und zieht den km-Stand am LKW
-- nach. Für den Fahrer bleibt die Tankliste ein Fahrtenbuch.
-- Die Preise bleiben bei set_tank_entry_prices; nur der AdBlue-Preis fällt
-- weg, wenn der Chef das AdBlue entfernt — ohne AdBlue kein AdBlue-Preis.
--
-- Die Prüfungen auf gültige Werte (km >= 0, Liter > 0, Kennzeichen nicht
-- leer) übernehmen die Check-Constraints der Tabelle, wie beim Erfassen.
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
  if coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'boss' then
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

  -- Kilometerstand am Fahrzeug neu aus den Tankungen bestimmen. Der Trigger
  -- zieht ihn nur mit greatest() nach oben — ein korrigierter Tippfehler
  -- (343890 statt 34389) bliebe sonst für immer am LKW stehen. Weiterhin der
  -- höchste Stand aller Tankungen, eine nachgetragene ältere Tankung zieht
  -- ihn also nicht nach unten. Beide Kennzeichen, falls der Chef es geändert
  -- hat; bleibt beim alten keine Tankung übrig, behält es seinen Stand.
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

notify pgrst, 'reload schema';
