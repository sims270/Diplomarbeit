-- Sammelrechnungen: eine Rechnung über mehrere Ladungen.
--
-- Bisher galt "ein Auftrag, eine Rechnung" — der Auftrag war der Schlüssel
-- der Tabelle invoices, und die Position (Ladestelle, Preis, …) stand direkt
-- in der Rechnungszeile. Große Kunden wollen aber nicht für jede Ladung eine
-- eigene Rechnung, sondern eine gesammelte nach drei, vier, fünf Fahrten.
--
-- Deshalb wird die Rechnung aufgeteilt:
--
--   invoices       — der Kopf: Belegnummer, Datum, Empfänger, Ust,
--                    Zahlungsziel. Eigene id statt order_id.
--   invoice_items  — je verrechnetem Auftrag eine Position. order_id ist
--                    eindeutig: ein Auftrag kann nur auf genau einer
--                    Rechnung stehen, sonst würde dieselbe Fahrt doppelt
--                    verrechnet.
--
-- Eine Einzelrechnung ist schlicht eine Rechnung mit einer Position. Die
-- bestehenden Rechnungen werden unten genau so übernommen — Belegnummer und
-- Inhalt bleiben, was sie waren.
--
-- Die Datei ist wie alle Migrationen dieses Projekts beliebig oft
-- ausführbar: jeder Umbauschritt prüft vorher, ob er schon passiert ist.
--
-- WICHTIG: gemeinsam mit der neuen Fassung der Edge Function export-invoice
-- einspielen. Die alte Fassung kennt invoices.order_id und scheitert nach
-- dieser Migration.

-- --- 1. Eigene id für den Rechnungskopf ------------------------------------
-- gen_random_uuid() ist volatil, Postgres füllt damit jede bestehende Zeile
-- mit einer eigenen id.
alter table public.invoices
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  -- Der Primärschlüssel liegt noch auf order_id? Dann auf id umhängen.
  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.conrelid = 'public.invoices'::regclass
       and c.contype = 'p'
       and a.attname = 'id'
  ) then
    alter table public.invoices drop constraint if exists invoices_pkey;
    alter table public.invoices add constraint invoices_pkey primary key (id);
  end if;
end $$;

-- --- 2. Positionen ----------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  -- unique: dieselbe Fahrt darf nicht auf zwei Rechnungen stehen.
  order_id uuid not null unique references public.orders(id) on delete cascade,
  -- Reihenfolge auf der Rechnung. Lücken nach dem Entfernen einer Position
  -- sind egal, es wird nur danach sortiert.
  reihenfolge integer not null default 1,

  -- Dieselben Felder wie bisher in invoices. bezeichnung bleibt null, bis
  -- die Edge Function die Position aus dem Auftrag vorbefüllt hat — das
  -- Formular speichert immer einen String, nie null.
  position_datum date,
  bezeichnung text,
  transportnr text,
  ladestelle text,
  ladedatum date,
  entladestelle text,
  entladedatum date,
  -- numeric, nicht float: bei Geld darf sich kein Rundungsfehler einschleichen.
  preis numeric(12, 2),

  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id);

-- --- 3. Bestehende Rechnungen übernehmen -----------------------------------
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'invoices'
       and column_name = 'order_id'
  ) then
    insert into public.invoice_items (
      invoice_id, order_id, reihenfolge, position_datum, bezeichnung,
      transportnr, ladestelle, ladedatum, entladestelle, entladedatum, preis
    )
    select
      id, order_id, 1, position_datum, bezeichnung,
      transportnr, ladestelle, ladedatum, entladestelle, entladedatum, preis
      from public.invoices
    on conflict (order_id) do nothing;

    alter table public.invoices
      drop column order_id,
      drop column position_datum,
      drop column bezeichnung,
      drop column transportnr,
      drop column ladestelle,
      drop column ladedatum,
      drop column entladestelle,
      drop column entladedatum,
      drop column preis;
  end if;
end $$;

-- Rechnungen, deren Nummer schon vergeben, deren Inhalt aber nie befüllt
-- wurde (aus der Zeit vor den bearbeitbaren Feldern), bekommen die
-- formatierte Belegnummer jetzt gleich. Ob der Kopf vorbefüllt ist, erkennt
-- die Edge Function ab jetzt an empfaenger_name.
update public.invoices
   set belegnummer = case when nummer < 10 then '0' || nummer::text else nummer::text end
                     || '/' || jahr::text
 where belegnummer is null;

-- --- 4. Rechte --------------------------------------------------------------
-- Wie bei invoices: lesen und ändern darf der Chef direkt, angelegt und
-- entfernt werden Positionen nur über die Edge Function (die prüft, dass
-- der Auftrag erledigt ist und die letzte Position nicht verschwindet).
alter table public.invoice_items enable row level security;

drop policy if exists "Boss can read invoice items" on public.invoice_items;
create policy "Boss can read invoice items"
  on public.invoice_items for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

drop policy if exists "Boss can edit invoice items" on public.invoice_items;
create policy "Boss can edit invoice items"
  on public.invoice_items for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

-- --- 5. Anlegen einer Rechnung ---------------------------------------------
-- Die alte Funktion hing an order_id und hat keine Grundlage mehr.
drop function if exists public.assign_invoice_number(uuid, integer);

/**
 * Legt eine Rechnung über die angegebenen Aufträge an — einen für die
 * Einzelrechnung, mehrere für die Sammelrechnung — und vergibt dabei die
 * nächste Belegnummer des Jahres ("01/2026", "02/2026", …).
 *
 * Alles in einer Transaktion: steht einer der Aufträge schon auf einer
 * anderen Rechnung, scheitert das Einfügen der Position am unique auf
 * order_id, und die Belegnummer ist nicht verbraucht. Eine Nummernlücke in
 * der Buchhaltung entsteht so nicht.
 *
 * Die Reihenfolge der Positionen ist die Reihenfolge im Array.
 */
create or replace function public.create_invoice(p_order_ids uuid[], p_jahr integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nummer integer;
begin
  if coalesce(array_length(p_order_ids, 1), 0) = 0 then
    raise exception 'Keine Aufträge für die Rechnung ausgewählt.';
  end if;

  -- Zwei gleichzeitige Rechnungen dürfen nicht dieselbe Nummer ziehen. Die
  -- Sperre gilt nur für dieses Jahr und endet mit der Transaktion.
  perform pg_advisory_xact_lock(hashtext('invoice_nummer_' || p_jahr::text));

  if exists (select 1 from public.invoice_items where order_id = any (p_order_ids)) then
    raise exception 'Mindestens einer der Aufträge steht bereits auf einer Rechnung.';
  end if;

  select coalesce(max(nummer), 0) + 1
    into v_nummer
    from public.invoices
   where jahr = p_jahr;

  -- Zweistellig wie auf den bisherigen Rechnungen, ab der hundertsten von
  -- selbst dreistellig. Bewusst kein lpad — das würde "100" auf "10" kürzen.
  insert into public.invoices (jahr, nummer, belegnummer)
  values (
    p_jahr,
    v_nummer,
    case when v_nummer < 10 then '0' || v_nummer::text else v_nummer::text end
      || '/' || p_jahr::text
  )
  returning id into v_id;

  insert into public.invoice_items (invoice_id, order_id, reihenfolge)
  select v_id, o.order_id, o.ord
    from unnest(p_order_ids) with ordinality as o(order_id, ord);

  return v_id;
end;
$$;

-- Nur serverseitig aus export-invoice mit dem service_role-Schlüssel — eine
-- gezogene Belegnummer ist verbraucht.
revoke all on function public.create_invoice(uuid[], integer) from public;
revoke all on function public.create_invoice(uuid[], integer) from anon;
revoke all on function public.create_invoice(uuid[], integer) from authenticated;
grant execute on function public.create_invoice(uuid[], integer) to service_role;

notify pgrst, 'reload schema';
