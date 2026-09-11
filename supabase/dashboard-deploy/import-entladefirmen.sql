-- Vorlage zum Einspielen der Entladefirmen, sobald die Liste vorliegt.
--
-- Kein Migrationsschritt, sondern zum Ausführen im Supabase SQL Editor:
-- Die Namen sind Daten, keine Schemaänderung — sie gehören nicht ins
-- Repository, und die Liste kann jederzeit wieder wachsen.
--
-- Voraussetzung: Die Tabelle muss existieren, also zuerst
-- supabase/migrations/20260910110000_create_unloading_companies.sql
-- ausführen.
--
-- ANWENDUNG
--   1. Die Namen unten austauschen — je Firma eine Zeile in Hochkommas,
--      mit Beistrich getrennt, die letzte ohne.
--      Enthält ein Name selbst ein Hochkomma, wird es verdoppelt:
--      'O''Brien Logistik GmbH'
--   2. Im SQL Editor ausführen.
--
-- Mehrfaches Ausführen ist unbedenklich: Was schon drinsteht, wird
-- übersprungen (on conflict do nothing), nichts wird überschrieben oder
-- gelöscht.
--
-- Die Namen werden beim Einfügen genauso bereinigt wie im Dropdown:
-- nachlaufende und doppelte Leerzeichen fallen weg, geschützte
-- Leerzeichen (U+00A0) werden zu normalen. Damit entsteht aus einer
-- Kopiervorlage mit unsauberen Leerzeichen keine doppelte Firma.

insert into public.unloading_companies (name)
select distinct on (lower(bereinigt)) bereinigt
from (
  select btrim(regexp_replace(replace(name, chr(160), ' '), '\s+', ' ', 'g')) as bereinigt
  from (values
    -- ▼▼▼ hier die echten Firmen eintragen ▼▼▼
    ('Beispiel Entladefirma GmbH'),
    ('Zweite Entladefirma AG'),
    ('Dritte Entladefirma KG')
    -- ▲▲▲ hier die echten Firmen eintragen ▲▲▲
  ) as eingabe(name)
) as bereinigte
where bereinigt <> ''
on conflict (name) do nothing;

-- Kontrolle: was jetzt in der Liste steht.
select name from public.unloading_companies order by name;
