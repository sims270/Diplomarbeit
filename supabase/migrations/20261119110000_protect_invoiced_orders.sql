-- Verrechnete Aufträge sind geschützt, und Konten lassen sich trotz angelegter
-- Aufträge löschen.
--
-- 1. invoice_items hing per on delete cascade am Auftrag. Beim Löschen eines
--    verrechneten Auftrags verschwand still die Position aus der ausgestellten
--    Rechnung. Rechnungen müssen aber unverändert aufbewahrt werden (§ 132 BAO).
--    Jetzt lehnt die Datenbank das Löschen ab (Fehler 23503).
--
-- 2. created_by zeigte ohne Löschregel auf auth.users. Ein Chef, der Aufträge
--    angelegt hat, ließ sich deshalb nicht löschen. Der Auftrag gehört der
--    Firma und bleibt, nur der Verweis auf das Konto wird leer.
--
-- Die Namen der Fremdschlüssel werden aus dem Katalog gelesen, weil die
-- Datenbank nicht in jedem Punkt dem Repository entspricht.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as table_name, c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and (
         (c.conrelid = 'public.invoice_items'::regclass
           and a.attname in ('order_id', 'external_order_id'))
         or (c.conrelid in ('public.orders'::regclass, 'public.external_orders'::regclass)
           and a.attname = 'created_by')
       )
  loop
    execute format('alter table %s drop constraint %I', fk.table_name, fk.conname);
  end loop;
end $$;

alter table public.invoice_items
  add constraint invoice_items_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

alter table public.invoice_items
  add constraint invoice_items_external_order_id_fkey
  foreign key (external_order_id) references public.external_orders(id) on delete restrict;

alter table public.orders
  add constraint orders_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.external_orders
  add constraint external_orders_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
