-- Fremdaufträge verrechnen.
--
-- Bei einem Fremdauftrag fährt ein fremder Frachtführer — den bezahlt die
-- Firma, verrechnet wird er nicht. Die Firma, von der der Auftrag kommt,
-- bekommt aber genauso eine Rechnung wie beim eigenen Auftrag, als
-- Einzel- oder Sammelrechnung, auch gemischt mit eigenen Aufträgen.
--
-- Bisher zeigte jede Position (invoice_items, 20260914130000) auf genau
-- einen eigenen Auftrag (orders). Jetzt zeigt sie entweder auf einen
-- eigenen oder auf einen Fremdauftrag — genau eines von beiden, das
-- sichert der CHECK. Beide Spalten sind unique: Dieselbe Fahrt kann weiter
-- nur auf einer Rechnung stehen.
--
-- Die ids beider Tabellen sind uuids und damit nie gleich. Die Edge
-- Function und create_invoice bekommen deshalb weiter eine einzige Liste
-- von Auftrags-ids und finden selbst heraus, aus welcher Tabelle jede kommt.
--
-- WICHTIG: gemeinsam mit der neuen Fassung der Edge Function export-invoice
-- einspielen.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Position: eigener Auftrag ODER Fremdauftrag -------------------------
alter table public.invoice_items
  alter column order_id drop not null;

alter table public.invoice_items
  add column if not exists external_order_id uuid unique
    references public.external_orders(id) on delete cascade;

alter table public.invoice_items
  drop constraint if exists invoice_items_one_order_check;

alter table public.invoice_items
  add constraint invoice_items_one_order_check check (
    num_nonnulls(order_id, external_order_id) = 1
  );

-- --- 2. Anlegen einer Rechnung ---------------------------------------------
-- Gleiche Funktion wie bisher (Belegnummer und Positionen in einer
-- Transaktion), nur dass jede id jetzt in die passende Spalte kommt.
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

  insert into public.invoices (jahr, nummer, belegnummer)
  values (
    p_jahr,
    v_nummer,
    case when v_nummer < 10 then '0' || v_nummer::text else v_nummer::text end
      || '/' || p_jahr::text
  )
  returning id into v_id;

  -- Eine id, die in keiner der beiden Tabellen steht, landet in keiner
  -- Spalte — dann scheitert der CHECK, und mit ihm die ganze Rechnung samt
  -- Belegnummer.
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

notify pgrst, 'reload schema';
