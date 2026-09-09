-- Tankliste — die digitale Ablösung des Papierzettels "Tankliste", den die
-- Fahrer bisher im LKW ausgefüllt haben. Der Zettel hat genau die Spalten
-- Datum, Kennzeichen, km-Stand, Liter/Diesel, Liter/AdBlue und
-- Tankstelle-Ort; diese Tabelle bildet sie 1:1 ab.
--
-- Preise stehen bewusst nicht hier: sie stehen nicht auf dem Zettel. Der
-- Chef trägt sie weiterhin separat in seiner Excel-Datei nach.
--
-- Kennzeichen ist Freitext, und zwar nicht aus Bequemlichkeit: einen
-- Fahrzeug- oder Flottenstamm gibt es in diesem Schema nicht. Das einzige
-- vorhandene license_plate sitzt auf external_orders und meint dort den
-- LKW eines Subunternehmers — fachlich etwas anderes als der eigene LKW,
-- den ein angestellter Fahrer betankt. Es gibt hier also nichts zu
-- referenzieren, was zu referenzieren wäre.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tank_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Wer getankt hat. Fahrer sind Auth-Accounts mit role 'driver' im
  -- user_metadata (siehe supabase/functions/_shared/verify-boss.ts) — eine
  -- eigene Fahrertabelle existiert nicht, deshalb hängt der Eintrag direkt
  -- an auth.users.
  driver_id uuid not null references auth.users(id) default auth.uid(),

  entry_date date not null,

  -- So, wie der Fahrer es eingetippt hat (nur getrimmt) — das bleibt für
  -- ihn wiedererkennbar.
  license_plate text not null,

  -- Der Gruppierungsschlüssel für "ein Arbeitsblatt pro Kennzeichen" im
  -- Excel-Export. Ohne ihn würden "GR400FX", "gr400fx" und "GR 400 FX"
  -- zu drei getrennten Arbeitsblättern desselben LKW führen — bei
  -- handgetippten Kennzeichen keine theoretische Sorge. Als generierte
  -- Spalte statt per Trigger, damit der Schlüssel gar nicht erst von der
  -- aufrufenden Seite abhängen kann.
  license_plate_key text generated always as (
    upper(regexp_replace(license_plate, '\s+', '', 'g'))
  ) stored,

  km_stand integer not null,
  liters_diesel numeric(10, 2) not null,

  -- AdBlue wird nicht bei jedem Tankvorgang nachgefüllt; auf dem Zettel
  -- steht dann ein Strich. Deshalb nullable statt 0 — "nicht nachgefüllt"
  -- und "0 Liter nachgefüllt" sind nicht dasselbe.
  liters_adblue numeric(10, 2),

  fuel_station text not null default '',

  -- Tippfehler wie ein negativer km-Stand oder 0 Liter Diesel sind keine
  -- gültigen Tankvorgänge und haben in der Auswertung nichts verloren.
  constraint tank_entries_km_stand_check check (km_stand >= 0),
  constraint tank_entries_liters_diesel_check check (liters_diesel > 0),
  constraint tank_entries_liters_adblue_check check (
    liters_adblue is null or liters_adblue > 0
  ),
  constraint tank_entries_license_plate_check check (
    length(btrim(license_plate)) > 0
  )
);

-- Der Fahrer sieht seine Einträge nach Datum absteigend, der Export
-- gruppiert nach Kennzeichen und sortiert je Blatt nach Datum. Genau
-- diese beiden Zugriffe deckt das ab.
create index if not exists tank_entries_driver_date_idx
  on public.tank_entries (driver_id, entry_date desc);

create index if not exists tank_entries_plate_date_idx
  on public.tank_entries (license_plate_key, entry_date);

alter table public.tank_entries enable row level security;

-- Rollen liegen im JWT-user_metadata, dieselbe Prüfung wie in
-- 20260907150000_create_orders.sql.
create policy "Boss can read all tank entries"
  on public.tank_entries for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Driver can read own tank entries"
  on public.tank_entries for select
  to authenticated
  using (driver_id = auth.uid());

-- with check statt using: beim INSERT gibt es noch keine bestehende Zeile
-- zu prüfen. Das hier ist der Riegel, der verhindert, dass ein Fahrer
-- einen Eintrag auf den Namen eines Kollegen schreibt.
create policy "Driver can create own tank entries"
  on public.tank_entries for insert
  to authenticated
  with check (driver_id = auth.uid());

-- Bewusst keine UPDATE-/DELETE-Policy: die Tankliste ist ein Fahrtenbuch,
-- kein bearbeitbares Dokument. Ohne Policy verweigert RLS beides, für
-- jeden. Korrekturen laufen über den Chef direkt in Supabase.

-- PostgREST cached den Tabellenkatalog; ohne diesen Anstoß meldet der
-- Client die Tabelle als unbekannt, bis der Cache von selbst neu lädt.
notify pgrst, 'reload schema';
