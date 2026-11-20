-- Firmentabellen auf den Stand der laufenden Datenbank bringen.
--
-- Zwei frühere Migrationen sind verloren gegangen
-- (20260911140000_dedupe_company_names.sql und 20260911170000). Ihr Ergebnis
-- steht nur in der laufenden Datenbank. Eine aus dem Repository neu
-- aufgesetzte Datenbank, etwa das Test-Projekt, hatte deshalb ein anderes
-- Schema. Abgeglichen per Katalogabfrage am 20.11.2026:
--
--   * carrier_companies und site_companies haben KEIN unique auf name. Eine
--     Firma kann mehrere Standorte unter demselben Namen haben
--     (app/services/siteCompanyService.ts, carrierCompanyService.ts).
--   * Eindeutig ist stattdessen die BMD-Kontonummer.
--   * site_companies verhindert Dubletten über Name und Anschrift, normalisiert
--     mit normalize_company_name (gleiche Regel wie companyDirectory.ts).
--   * carrier_companies hat dieselben Stammdatenspalten wie site_companies.
--
-- In der laufenden Datenbank ändert diese Migration nichts: Jeder Schritt
-- prüft vorher, ob er schon erledigt ist, oder setzt den Wert, der dort
-- schon steht. Constraint-Namen stammen aus pg_constraint der laufenden
-- Datenbank.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Normalisierung von Firmennamen ----------------------------------------
-- Nur anlegen, wenn sie fehlt: Der Index unten hängt an ihr, und die laufende
-- Datenbank soll ihre Fassung unverändert behalten. Inhalt identisch mit der
-- Fassung dort.
do $$
begin
  if to_regprocedure('public.normalize_company_name(text)') is null then
    execute $f$
      create function public.normalize_company_name(value text)
      returns text
      language sql
      immutable
      as $body$
        select btrim(regexp_replace(replace(coalesce(value, ''), chr(160), ' '), '\s+', ' ', 'g'));
      $body$
    $f$;
  end if;
end $$;

-- --- 2. Stammdatenspalten -----------------------------------------------------
alter table public.carrier_companies
  add column if not exists bmd_kto_nr text,
  add column if not exists zahlungsziel_tage integer,
  add column if not exists skonto_prozent numeric,
  add column if not exists skonto_tage integer,
  add column if not exists uid_nummer text,
  add column if not exists ohne_steuer boolean,
  add column if not exists updated_at timestamptz;

-- Standardwerte wie in der laufenden Datenbank. Gilt nur für neue Zeilen.
alter table public.carrier_companies
  alter column ohne_steuer set default false,
  alter column updated_at set default now();

alter table public.site_companies
  alter column ohne_steuer set default false,
  alter column updated_at set default now();

-- --- 3. Kein unique auf name ----------------------------------------------------
alter table public.carrier_companies
  drop constraint if exists carrier_companies_name_key;

alter table public.site_companies
  drop constraint if exists site_companies_name_key;

-- --- 4. BMD-Kontonummer eindeutig -----------------------------------------------
-- Mehrere Zeilen ohne Kontonummer (null) bleiben erlaubt.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.carrier_companies'::regclass
       and conname = 'carrier_companies_bmd_kto_nr_key'
  ) then
    alter table public.carrier_companies
      add constraint carrier_companies_bmd_kto_nr_key unique (bmd_kto_nr);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.site_companies'::regclass
       and conname = 'site_companies_bmd_kto_nr_key'
  ) then
    alter table public.site_companies
      add constraint site_companies_bmd_kto_nr_key unique (bmd_kto_nr);
  end if;
end $$;

-- --- 5. Keine Dubletten bei Name und Anschrift ----------------------------------
create unique index if not exists site_companies_standort_norm_idx
  on public.site_companies (
    lower(public.normalize_company_name(name)),
    lower(public.normalize_company_name(strasse)),
    lower(public.normalize_company_name(plz)),
    lower(public.normalize_company_name(ort))
  );

notify pgrst, 'reload schema';
