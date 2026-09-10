-- Der Inhalt der Rechnung, bearbeitbar im Chef-Dashboard.
--
-- Bisher wurde jede Zeile der Rechnung beim Export frisch aus dem Auftrag
-- abgeleitet — änderbar war nichts. Eine Rechnung weicht aber regelmäßig
-- vom Auftrag ab: der Preis wird ausgehandelt, die Bezeichnung der Ladung
-- ist ausführlicher als "1 Ladung", und manchmal geht die Rechnung an eine
-- andere Anschrift als die Ladestelle.
--
-- Deshalb hält die Rechnung ihren Inhalt jetzt selbst. Beim ersten Öffnen
-- füllt die Edge Function export-invoice die Felder aus dem Auftrag vor
-- (das bleibt der bequeme Normalfall), danach zählt allein, was hier
-- steht. Der Auftrag wird durch eine Änderung an der Rechnung nie
-- verändert: er dokumentiert die Fahrt, die Rechnung das Geschäft.
--
-- Alle Spalten sind nullable — eine Rechnung, die gerade erst angelegt
-- wurde, hat noch nichts ausgefüllt, und leere Felder bleiben in der
-- Excel-Datei einfach leer.
alter table public.invoices
  -- Kopf
  add column if not exists belegnummer text,
  add column if not exists rechnungsdatum date,
  add column if not exists empfaenger_name text,
  add column if not exists empfaenger_strasse text,
  add column if not exists empfaenger_ort text,
  add column if not exists kundennummer text,
  add column if not exists uid_nummer text,

  -- Position
  add column if not exists position_datum date,
  add column if not exists bezeichnung text,
  add column if not exists transportnr text,
  add column if not exists ladestelle text,
  add column if not exists ladedatum date,
  add column if not exists entladestelle text,
  add column if not exists entladedatum date,

  -- Beträge. numeric, nicht float: bei Geld darf sich kein Rundungsfehler
  -- einschleichen.
  add column if not exists preis numeric(12, 2),
  add column if not exists ust_satz numeric(5, 2),
  add column if not exists zahlungsziel text,

  add column if not exists updated_at timestamptz not null default now();

-- Der Chef bearbeitet die Rechnung im Dashboard, also darf er die Zeile
-- ändern. Angelegt wird sie weiterhin ausschließlich serverseitig von der
-- Edge Function (dort wird auch die Belegnummer vergeben) — es gibt daher
-- bewusst keine insert-Policy für Clients.
--
-- drop davor, weil Postgres kein "create policy if not exists" kennt und
-- diese Datei mehrfach ausführbar bleiben soll.
drop policy if exists "Boss can edit invoices" on public.invoices;

create policy "Boss can edit invoices"
  on public.invoices for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

-- PostgREST cached den Spaltenkatalog; ohne diesen Anstoß meldet der Client
-- die neuen Spalten als unbekannt, bis der Cache von selbst neu lädt.
notify pgrst, 'reload schema';
