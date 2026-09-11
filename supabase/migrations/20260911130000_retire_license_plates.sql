-- LKW ausflotten: verkauft, abgemeldet, verschrottet. Der Chef nimmt ihn
-- aus der Flotte, ohne dass etwas verloren geht.
--
-- Bewusst ein Datum statt eines DELETE. Ein gelöschter LKW hieße:
--
--   * Marke, Baujahr und der letzte Kilometerstand wären weg — genau die
--     Angaben, die man nach einem Verkauf noch braucht.
--   * Der Trigger aus 20260911110000 legte ihn bei der nächsten Tankung
--     auf dieses Kennzeichen kommentarlos neu an, dann ohne Fahrzeugdaten.
--   * Fahrer, denen er noch zugeteilt ist, zeigten auf ein Kennzeichen,
--     zu dem es kein Fahrzeug mehr gibt.
--
-- Die Tankeinträge selbst sind davon ohnehin nicht betroffen: tank_entries
-- verweist nicht per Fremdschlüssel hierher, sondern führt das Kennzeichen
-- als eigenen Text mit (siehe 20260909100000_create_tank_entries.sql). Die
-- Tankliste und ihr Excel-Export lesen direkt dort — ein ausgeflotteter LKW
-- bleibt darin bis zur letzten Tankung vollständig erhalten.
--
-- null heißt "in der Flotte". Ein Datum ist zugleich die Antwort auf
-- "seit wann nicht mehr" — ein boolescher Schalter wäre es nicht.
alter table public.license_plates
  add column if not exists retired_at timestamptz;

-- Die Auswahl bei der Fahrerzuteilung fragt genau danach.
create index if not exists license_plates_retired_at_idx
  on public.license_plates (retired_at);

notify pgrst, 'reload schema';
