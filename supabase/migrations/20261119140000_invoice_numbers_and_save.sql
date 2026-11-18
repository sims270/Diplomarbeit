-- Eindeutige Belegnummern und atomares Speichern der Rechnung.
--
-- 1. Rechnungsnummern müssen eindeutig sein (§ 11 UStG). Die Belegnummer ist
--    aber von Hand änderbar und hatte keinen unique-Index.
-- 2. create_invoice überspringt jetzt belegte Nummern. Sonst würde jede neue
--    Rechnung scheitern, sobald der Chef eine Nummer von Hand auf eine spätere
--    Nummer geändert hat.
-- 3. save_invoice schreibt Kopf und Positionen in einer Transaktion. Bisher
--    gingen sie als einzelne Updates hinaus, und ein Fehler hinterließ eine
--    halb gespeicherte Rechnung.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Eindeutige Belegnummer ----------------------------------------------
-- Vorab prüfen, damit bei Altdaten klar dasteht, welche Nummern doppelt sind.
do $$
declare
  v_doppelt text;
begin
  select string_agg(belegnummer, ', ')
    into v_doppelt
    from (
      select belegnummer
        from public.invoices
       where belegnummer is not null and belegnummer <> ''
       group by belegnummer
      having count(*) > 1
    ) d;

  if v_doppelt is not null then
    raise exception 'Doppelte Belegnummern, bitte zuerst korrigieren: %', v_doppelt;
  end if;
end $$;

create unique index if not exists invoices_belegnummer_key
  on public.invoices (belegnummer)
  where belegnummer is not null and belegnummer <> '';

-- --- 2. Anlegen einer Rechnung ----------------------------------------------
create or replace function public.create_invoice(p_order_ids uuid[], p_jahr integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nummer integer;
  v_belegnummer text;
begin
  if coalesce(array_length(p_order_ids, 1), 0) = 0 then
    raise exception 'Keine Aufträge für die Rechnung ausgewählt.';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_nummer_' || p_jahr::text));

  if exists (
    select 1
      from public.invoice_items
     where order_id = any (p_order_ids)
        or external_order_id = any (p_order_ids)
  ) then
    raise exception 'Mindestens einer der Aufträge steht bereits auf einer Rechnung.';
  end if;

  select coalesce(max(nummer), 0) + 1
    into v_nummer
    from public.invoices
   where jahr = p_jahr;

  loop
    v_belegnummer := case when v_nummer < 10 then '0' || v_nummer::text else v_nummer::text end
                     || '/' || p_jahr::text;
    exit when not exists (
      select 1 from public.invoices where belegnummer = v_belegnummer
    );
    v_nummer := v_nummer + 1;
  end loop;

  insert into public.invoices (jahr, nummer, belegnummer)
  values (p_jahr, v_nummer, v_belegnummer)
  returning id into v_id;

  -- Eine id, die in keiner der beiden Tabellen steht, landet in keiner
  -- Spalte. Dann scheitert der CHECK und mit ihm die ganze Rechnung.
  insert into public.invoice_items (invoice_id, order_id, external_order_id, reihenfolge)
  select v_id,
         (select o.id from public.orders o where o.id = x.id),
         (select e.id from public.external_orders e where e.id = x.id),
         x.ord
    from unnest(p_order_ids) with ordinality as x(id, ord);

  return v_id;
end;
$$;

revoke all on function public.create_invoice(uuid[], integer) from public;
revoke all on function public.create_invoice(uuid[], integer) from anon;
revoke all on function public.create_invoice(uuid[], integer) from authenticated;
grant execute on function public.create_invoice(uuid[], integer) to service_role;

-- --- 3. Rechnung speichern --------------------------------------------------
-- security invoker: Es gelten die RLS-Policies des Aufrufers, schreiben darf
-- also weiterhin nur der Chef. Positionen fremder Rechnungen bleiben außen vor.
create or replace function public.save_invoice(
  p_invoice_id uuid,
  p_header jsonb,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
begin
  update public.invoices
     set belegnummer = p_header ->> 'belegnummer',
         rechnungsdatum = (p_header ->> 'rechnungsdatum')::date,
         empfaenger_name = p_header ->> 'empfaenger_name',
         empfaenger_strasse = p_header ->> 'empfaenger_strasse',
         empfaenger_ort = p_header ->> 'empfaenger_ort',
         kundennummer = p_header ->> 'kundennummer',
         uid_nummer = p_header ->> 'uid_nummer',
         ust_satz = (p_header ->> 'ust_satz')::numeric,
         zahlungsziel = p_header ->> 'zahlungsziel',
         netto_betrag = (p_header ->> 'netto_betrag')::numeric,
         ust_betrag = (p_header ->> 'ust_betrag')::numeric,
         end_betrag = (p_header ->> 'end_betrag')::numeric,
         updated_at = now()
   where id = p_invoice_id;

  if not found then
    raise exception 'Rechnung nicht gefunden' using errcode = 'no_data_found';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.invoice_items
       set position_datum = (v_item ->> 'position_datum')::date,
           bezeichnung = v_item ->> 'bezeichnung',
           transportnr = v_item ->> 'transportnr',
           ladestelle = v_item ->> 'ladestelle',
           ladedatum = (v_item ->> 'ladedatum')::date,
           entladestelle = v_item ->> 'entladestelle',
           entladedatum = (v_item ->> 'entladedatum')::date,
           preis = (v_item ->> 'preis')::numeric
     where id = (v_item ->> 'id')::uuid
       and invoice_id = p_invoice_id;

    if not found then
      raise exception 'Rechnungsposition nicht gefunden' using errcode = 'no_data_found';
    end if;
  end loop;
end;
$$;

revoke all on function public.save_invoice(uuid, jsonb, jsonb) from public;
revoke all on function public.save_invoice(uuid, jsonb, jsonb) from anon;
grant execute on function public.save_invoice(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
