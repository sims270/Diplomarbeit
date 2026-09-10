-- Adresse je Lade-/Entladefirma. Bisher stand in site_companies nur der
-- Name, die Straße und der Ort mussten bei jedem Auftrag neu getippt
-- werden — obwohl sie pro Firma immer gleich sind. Mit diesen Spalten
-- füllt die Auswahl einer Firma im Abschnitt "Ladung"/"Entladung" das
-- Adressfeld gleich mit (components/OwnOrderForm.tsx,
-- components/ExternalOrderForm.tsx).
--
-- "add column if not exists", weil die Spalten auf der Produktionsdatenbank
-- bereits von Hand im Supabase-Dashboard angelegt wurden — diese Migration
-- holt nur das Schema im Repository nach.
alter table public.site_companies
  add column if not exists strasse text,
  add column if not exists plz text,
  add column if not exists ort text;

-- PostgREST cached den Spaltenkatalog; ohne diesen Anstoß meldet der Client
-- die neuen Spalten als unbekannt, bis der Cache von selbst neu lädt.
notify pgrst, 'reload schema';
