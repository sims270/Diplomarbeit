-- Belegnummern der Rechnungen — "01/2026", "02/2026", … und im neuen Jahr
-- wieder bei "01/2027" beginnend.
--
-- Warum eine eigene Tabelle und keine Sequenz: eine Belegnummer muss
-- dauerhaft zum Auftrag gehören. Lädt der Chef dieselbe Rechnung ein
-- zweites Mal herunter, muss dieselbe Nummer herauskommen — sonst trüge das
-- Papier, das schon beim Kunden liegt, eine Nummer, die in der Buchhaltung
-- niemandem mehr zuzuordnen ist. Eine Sequenz würde bei jedem Aufruf
-- weiterzählen; hier wird die Nummer einmal vergeben und danach nur noch
-- nachgeschlagen.
--
-- Der Jahreswechsel braucht deshalb auch kein Zurücksetzen von Hand: die
-- laufende Nummer wird je Jahr gezählt, das erste Mal im neuen Jahr ergibt
-- die 1 von selbst.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invoices (
  -- Ein Auftrag, eine Rechnung: der Auftrag ist zugleich der Schlüssel.
  order_id uuid primary key references public.orders(id) on delete cascade,
  jahr integer not null,
  nummer integer not null,
  created_at timestamptz not null default now(),

  -- Zwei Rechnungen mit derselben Nummer im selben Jahr wären ein
  -- Buchhaltungsfehler — die Datenbank lässt das gar nicht erst zu.
  unique (jahr, nummer)
);

alter table public.invoices enable row level security;

-- Geschrieben wird ausschließlich über assign_invoice_number (security
-- definer, siehe unten) aus der Edge Function heraus. Der Chef darf die
-- vergebenen Nummern lesen, niemand darf sie über die API ändern.
--
-- Das drop davor, weil Postgres kein "create policy if not exists" kennt:
-- ohne diese Zeile scheitert ein zweiter Durchlauf dieser Datei im SQL
-- Editor mit 42710 ("policy already exists"), obwohl sich nichts geändert
-- hat. So bleibt die ganze Datei beliebig oft ausführbar.
drop policy if exists "Boss can read invoices" on public.invoices;

create policy "Boss can read invoices"
  on public.invoices for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

/**
 * Gibt die Belegnummer des Auftrags zurück und vergibt sie beim ersten
 * Aufruf. Das Ergebnis ist bereits fertig formatiert ("01/2026"), damit
 * Datenbank und Excel-Datei nicht zwei getrennte Vorstellungen davon haben
 * können, wie eine Belegnummer aussieht.
 */
create or replace function public.assign_invoice_number(p_order_id uuid, p_jahr integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nummer integer;
  v_jahr integer;
begin
  -- Schon vergeben? Dann bleibt es dabei, egal welches Jahr inzwischen ist.
  select nummer, jahr into v_nummer, v_jahr
    from public.invoices
   where order_id = p_order_id;

  if not found then
    -- Zwei gleichzeitige Exporte dürfen nicht dieselbe Nummer ziehen. Die
    -- Sperre gilt nur für dieses Jahr und endet mit der Transaktion; sie
    -- bremst also nicht den Export einer Rechnung aus einem anderen Jahr.
    perform pg_advisory_xact_lock(hashtext('invoice_nummer_' || p_jahr::text));

    insert into public.invoices (order_id, jahr, nummer)
    select
      p_order_id,
      p_jahr,
      coalesce(max(nummer), 0) + 1
      from public.invoices
     where jahr = p_jahr
    -- Hat ein paralleler Aufruf zwischen Abfrage und Sperre bereits eine
    -- Nummer für denselben Auftrag eingetragen, gilt dessen Nummer.
    on conflict (order_id) do nothing
    returning nummer, jahr into v_nummer, v_jahr;

    if v_nummer is null then
      select nummer, jahr into v_nummer, v_jahr
        from public.invoices
       where order_id = p_order_id;
    end if;
  end if;

  -- Zweistellig wie auf den bisherigen Rechnungen ("01/2026"), ab der
  -- hundertsten Rechnung eines Jahres von selbst dreistellig.
  --
  -- Bewusst kein lpad: das kürzt einen zu langen Wert auf die angegebene
  -- Länge, aus der 100. Rechnung würde damit "10/2026" — also die Nummer,
  -- die die zehnte Rechnung schon trägt.
  return case when v_nummer < 10 then '0' || v_nummer::text else v_nummer::text end
         || '/' || v_jahr::text;
end;
$$;

-- Aufgerufen wird die Funktion nur serverseitig aus der Edge Function
-- export-invoice mit dem service_role-Schlüssel. Kein Client soll sich
-- Belegnummern ziehen können — eine gezogene Nummer ist verbraucht.
revoke all on function public.assign_invoice_number(uuid, integer) from public;
revoke all on function public.assign_invoice_number(uuid, integer) from anon;
revoke all on function public.assign_invoice_number(uuid, integer) from authenticated;

-- Und ausdrücklich wieder für den Schlüssel, mit dem die Edge Function
-- arbeitet. Ohne diese Zeile nimmt das revoke oben service_role das Recht
-- mit, und der Export scheitert an "permission denied for function".
grant execute on function public.assign_invoice_number(uuid, integer) to service_role;

-- PostgREST cached den Schemakatalog; ohne diesen Anstoß meldet der Client
-- die neue Tabelle und Funktion als unbekannt, bis der Cache von selbst neu
-- lädt.
notify pgrst, 'reload schema';
