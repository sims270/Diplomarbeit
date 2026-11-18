-- Fremdauftrag und eigener Auftrag ineinander umwandeln.
--
-- Die Disposition ändert sich manchmal, nachdem ein Auftrag angelegt wurde:
-- Ein Fremdauftrag wird doch selbst gefahren, oder ein eigener geht doch an
-- einen Frachtführer. Der Auftrag zieht dann in die andere Tabelle um.
--
-- Id und Transportnummer bleiben gleich. An der Id hängt der Ordner der
-- Belege im Bucket order-documents — so bleiben CMR und Fotos beim Auftrag.
-- Umziehen und Löschen laufen in einer Transaktion: Es gibt nie beide
-- Fassungen und nie keine.
--
-- Nur offene Aufträge: Ein erledigter ist gefahren und wird verrechnet. Eine
-- bestehende Zuweisung fällt weg, der Chef weist danach neu zu.
--
-- external_orders.customer_price: der Preis für den Kunden, damit er den Weg
-- zum Fremdauftrag und zurück übersteht und auf der Rechnung landet. Nicht
-- zu verwechseln mit freight_rate, dem Preis für den Frachtführer. Der fremde
-- Fahrer sieht ihn nicht: Für ihn gibt es keine Policy auf external_orders,
-- und get_my_external_orders zählt seine Spalten einzeln auf.
--
-- Setzt 20261118100000_create_order_prices.sql voraus. Wie alle Migrationen
-- dieses Projekts beliebig oft ausführbar.

alter table public.external_orders
  add column if not exists customer_price numeric(12, 2)
  check (customer_price is null or customer_price >= 0);

-- --- 1. Fremdauftrag wird eigener Auftrag ------------------------------------
create or replace function public.convert_external_to_own_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.external_orders%rowtype;
begin
  if public.app_role() is distinct from 'boss' then
    raise exception 'Nur der Chef kann Aufträge umwandeln'
      using errcode = 'insufficient_privilege';
  end if;

  -- Sperrt die Zeile, damit der fremde Fahrer nicht gleichzeitig abschließt.
  select * into v from public.external_orders where id = p_order_id for update;

  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'no_data_found';
  end if;

  if v.status = 'completed'
     or exists (select 1 from public.invoice_items where external_order_id = p_order_id) then
    raise exception 'Erledigte Aufträge lassen sich nicht mehr umwandeln'
      using errcode = 'check_violation';
  end if;

  begin
    insert into public.orders (
      id, order_nr, created_at, updated_at, created_by, status,
      loading_date, loading_time_from, loading_time_until,
      loading_company, loading_address, loading_meters,
      unloading_date, unloading_time_from, unloading_time_until,
      unloading_company, unloading_address,
      client_company, client_address, cmr
    ) values (
      v.id, v.order_nr, v.created_at, now(), v.created_by, 'pending',
      v.loading_date, v.loading_time_from, v.loading_time_until,
      v.loading_company, v.loading_address, v.loading_meters,
      v.unloading_date, v.unloading_time_from, v.unloading_time_until,
      v.unloading_company, v.unloading_address,
      v.client_company, v.client_address, v.cmr
    );
  exception when unique_violation then
    raise exception 'Die Transportnummer % ist bei den eigenen Aufträgen schon vergeben. Bitte zuerst im Fremdauftrag ändern.', v.order_nr
      using errcode = 'unique_violation';
  end;

  if v.customer_price is not null then
    insert into public.order_prices (order_id, preis) values (v.id, v.customer_price);
  end if;

  delete from public.external_orders where id = p_order_id;
end;
$$;

-- --- 2. Eigener Auftrag wird Fremdauftrag ------------------------------------
-- Frachtführer und Frachtrate bleiben leer: Die trägt der Chef gleich danach
-- im Formular des Fremdauftrags ein.
create or replace function public.convert_own_to_external_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders%rowtype;
begin
  if public.app_role() is distinct from 'boss' then
    raise exception 'Nur der Chef kann Aufträge umwandeln'
      using errcode = 'insufficient_privilege';
  end if;

  -- Sperrt die Zeile, damit der Fahrer nicht gleichzeitig abschließt.
  select * into v from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'no_data_found';
  end if;

  if v.status = 'completed'
     or exists (select 1 from public.invoice_items where order_id = p_order_id) then
    raise exception 'Erledigte Aufträge lassen sich nicht mehr umwandeln'
      using errcode = 'check_violation';
  end if;

  begin
    insert into public.external_orders (
      id, order_nr, created_at, updated_at, created_by, status,
      loading_date, loading_time_from, loading_time_until,
      loading_company, loading_address, loading_meters,
      unloading_date, unloading_time_from, unloading_time_until,
      unloading_company, unloading_address,
      client_company, client_address, cmr, customer_price
    ) values (
      v.id, v.order_nr, v.created_at, now(), v.created_by, 'pending',
      v.loading_date, v.loading_time_from, v.loading_time_until,
      v.loading_company, v.loading_address, v.loading_meters,
      v.unloading_date, v.unloading_time_from, v.unloading_time_until,
      v.unloading_company, v.unloading_address,
      v.client_company, v.client_address, v.cmr,
      (select p.preis from public.order_prices p where p.order_id = v.id)
    );
  exception when unique_violation then
    raise exception 'Die Transportnummer % ist bei den Fremdaufträgen schon vergeben. Bitte zuerst im Auftrag ändern.', v.order_nr
      using errcode = 'unique_violation';
  end;

  -- order_prices fällt per on delete cascade mit weg.
  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.convert_external_to_own_order(uuid) from public;
revoke all on function public.convert_external_to_own_order(uuid) from anon;
grant execute on function public.convert_external_to_own_order(uuid) to authenticated;

revoke all on function public.convert_own_to_external_order(uuid) from public;
revoke all on function public.convert_own_to_external_order(uuid) from anon;
grant execute on function public.convert_own_to_external_order(uuid) to authenticated;

notify pgrst, 'reload schema';
