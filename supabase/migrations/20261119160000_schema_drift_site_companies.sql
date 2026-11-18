-- Spalten von site_companies, die bisher nur in der Datenbank standen.
--
-- Die Kundenstammdaten aus BMD wurden von Hand im Dashboard ergänzt. Wer die
-- Datenbank aus dem Repository neu aufsetzt, bekäme sonst ein anderes Schema,
-- und export-invoice fände Kundennummer und UID-Nummer nicht.
--
-- Namen und Typen stammen aus der laufenden Datenbank (Stand 18.11.2026). Dort
-- ändert diese Migration nichts. Standardwerte und not null sind bewusst nicht
-- angegeben, weil sie aus dem Spaltenkatalog nicht abgefragt wurden.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.site_companies
  add column if not exists bmd_kto_nr text,
  add column if not exists zahlungsziel_tage integer,
  add column if not exists skonto_prozent numeric,
  add column if not exists skonto_tage integer,
  add column if not exists uid_nummer text,
  add column if not exists ohne_steuer boolean,
  add column if not exists updated_at timestamptz;

notify pgrst, 'reload schema';
