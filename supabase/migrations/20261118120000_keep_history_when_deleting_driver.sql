-- Fahrer löschen, ohne seine Aufträge und Tankungen zu verlieren.
--
-- orders.assigned_to und tank_entries.driver_id zeigten ohne Löschregel auf
-- auth.users. Sobald ein Fahrer einen Auftrag oder eine Tankung hatte, lehnte
-- die Datenbank das Löschen seines Kontos ab.
--
-- Die Daten gehören zur Firma, nicht zum Konto: Umsatzliste, Tankliste und
-- Rechnungen brauchen sie weiter. Deshalb bleibt die Zeile bestehen, nur der
-- Verweis auf den Fahrer wird leer. Offene Aufträge setzt die Edge Function
-- delete-driver danach zurück auf "offen", damit sie neu zugewiesen werden.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.orders
  drop constraint if exists orders_assigned_to_fkey;

alter table public.orders
  add constraint orders_assigned_to_fkey
  foreign key (assigned_to) references auth.users(id) on delete set null;

alter table public.tank_entries
  alter column driver_id drop not null;

alter table public.tank_entries
  drop constraint if exists tank_entries_driver_id_fkey;

alter table public.tank_entries
  add constraint tank_entries_driver_id_fkey
  foreign key (driver_id) references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
