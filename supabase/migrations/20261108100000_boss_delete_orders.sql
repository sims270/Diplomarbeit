-- Chef darf eigene Aufträge und Fremdaufträge löschen.
--
-- Bisher gab es für orders und external_orders nur Policies für select,
-- insert und update — ein DELETE aus der App lief deshalb ins Leere (RLS
-- verwirft es still, 0 Zeilen). Gelöscht wird von der Bearbeiten-Seite aus,
-- nach Eingabe eines Bestätigungsworts (components/DeleteOrderModal.tsx).
--
-- Was mit dem Auftrag verschwindet (bestehende Fremdschlüssel, on delete
-- cascade): die Rechnung des Auftrags (invoices) und seine Zeile in einer
-- Sammelrechnung (invoice_items).
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

drop policy if exists "Boss can delete orders" on public.orders;
create policy "Boss can delete orders"
  on public.orders for delete
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can delete external orders" on public.external_orders;
create policy "Boss can delete external orders"
  on public.external_orders for delete
  to authenticated
  using ((select public.app_role()) = 'boss');

notify pgrst, 'reload schema';
