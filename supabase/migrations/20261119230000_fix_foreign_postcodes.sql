-- Länderkürzel vor der PLZ bei ausländischen Kunden nachtragen.
--
-- Die App schreibt die Anschrift als "Straße, A-PLZ Ort" und setzt "A-" vor
-- jede PLZ, die kein Kürzel mitbringt (app/services/companyAddress.ts). Beim
-- Import aus BMD kamen die PLZ ausländischer Kunden aber ohne Kürzel in die
-- Tabelle — so stand dann "A-33106 Paderborn" auf Transportauftrag und
-- Rechnung statt "D-33106 Paderborn".
--
-- Das Land wird hier NICHT aus der PLZ geraten ("33106" könnte Deutschland
-- oder Italien sein), sondern aus der UID-Nummer abgelesen, die mit dem
-- Länderkennzeichen beginnt: "DE 125231890" → D, "PL…" → PL, "IT…" → I.
-- Österreich (ATU…) bleibt unverändert. Kunden ohne UID und alle
-- Subunternehmer (carrier_companies haben keine UID) fasst das nicht an —
-- die listet die Kontrollabfrage im Chat auf, zum Nachtragen von Hand.
--
-- Die Kürzel sind die, die auch die Rechnung kennt (export-invoice,
-- COUNTRY_NAMES): D, I, CH, SLO, H, CZ, SK, PL, HR, F, NL, B, L, DK, S, RO,
-- BG, E, P, GB.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar: Eine PLZ, die
-- schon ein Kürzel hat, wird nie wieder angefasst — auch keine, die der Chef
-- inzwischen von Hand korrigiert hat.

with uid_land(prefix, code) as (
  values
    ('DE', 'D'),
    ('IT', 'I'),
    ('CHE', 'CH'),
    ('SI', 'SLO'),
    ('HU', 'H'),
    ('CZ', 'CZ'),
    ('SK', 'SK'),
    ('PL', 'PL'),
    ('HR', 'HR'),
    ('FR', 'F'),
    ('NL', 'NL'),
    ('BE', 'B'),
    ('LU', 'L'),
    ('DK', 'DK'),
    ('SE', 'S'),
    ('RO', 'RO'),
    ('BG', 'BG'),
    ('ES', 'E'),
    ('PT', 'P'),
    ('GB', 'GB'),
    ('XI', 'GB')
)
update public.site_companies s
   set plz = u.code || '-' || btrim(s.plz)
  from uid_land u
 where coalesce(btrim(s.plz), '') <> ''
   and s.plz !~ '^\s*[A-Za-z]{1,3}-'
   and upper(regexp_replace(coalesce(s.uid_nummer, ''), '\s', '', 'g')) like u.prefix || '%';
