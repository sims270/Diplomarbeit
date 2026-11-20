-- Referenznummer beim eigenen Auftrag.
--
-- Beim eigenen Auftrag ersetzt die Referenznummer im Formular die
-- Ladungslänge. Die Spalte loading_meters bleibt mit ihren Altdaten stehen:
-- Alte Aufträge zeigen ihre Lademeter weiter im PDF und in der Rechnung
-- (export-invoice), neue Aufträge lassen sie leer.
--
-- Beim Fremdauftrag heißt die bestehende Spalte loading_number in der App
-- jetzt ebenfalls "Referenznummer". Die Umwandlung zwischen eigenem und
-- Fremdauftrag nimmt sie deshalb in beide Richtungen mit
-- (orders.reference_number <-> external_orders.loading_number); sonst ginge
-- sie beim Umwandeln verloren. Beide Funktionen sind die Fassung aus
-- 20261119200000_add_cargo_description_to_orders.sql, nur um diese Spalte
-- ergänzt.
--
-- Der eigene Fahrer liest seine Aufträge direkt aus orders (RLS-Policy auf
-- die Zeile), die neue Spalte kommt also ohne weitere Änderung bei ihm an.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.orders
  add column if not exists reference_number text not null default '';

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
      loading_company, loading_address, loading_meters, cargo_description,
      reference_number,
      unloading_date, unloading_time_from, unloading_time_until,
      unloading_company, unloading_address,
      client_company, client_address, cmr
    ) values (
      v.id, v.order_nr, v.created_at, now(), v.created_by, 'pending',
      v.loading_date, v.loading_time_from, v.loading_time_until,
      v.loading_company, v.loading_address, v.loading_meters, coalesce(v.cargo_description, ''),
      coalesce(v.loading_number, ''),
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
      loading_company, loading_address, loading_meters, cargo_description,
      loading_number,
      unloading_date, unloading_time_from, unloading_time_until,
      unloading_company, unloading_address,
      client_company, client_address, cmr, customer_price
    ) values (
      v.id, v.order_nr, v.created_at, now(), v.created_by, 'pending',
      v.loading_date, v.loading_time_from, v.loading_time_until,
      v.loading_company, v.loading_address, v.loading_meters, coalesce(v.cargo_description, ''),
      coalesce(v.reference_number, ''),
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
