-- Auftraggeber je Auftrag — die Firma, die die Rechnung bekommt.
--
-- Bisher ging die Rechnung immer an die Ladestelle (loading_company). Das
-- stimmt nicht immer: Manchmal kommt der Auftrag von einer anderen Firma
-- als der, bei der geladen wird. Dann trägt der Chef hier den Auftraggeber
-- ein; leer heißt wie bisher "die Ladestelle ist der Auftraggeber".
--
--   client_company  Name des Auftraggebers; '' = Ladestelle.
--   client_address  Seine Anschrift ("Straße, A-PLZ Ort"), mitgenommen aus
--                   der Firmenliste, wenn der Chef ihn dort auswählt. Leer,
--                   wenn er den Namen nur tippt — dann sucht die Edge
--                   Function export-invoice die Anschrift über den Namen
--                   in site_companies.
--
-- Für eigene Aufträge (orders) und Fremdaufträge (external_orders) gleich,
-- denn beide werden verrechnet (20261005140000).
--
-- Nur für die Rechnung: Der Auftraggeber steht auf keinem PDF, und weder
-- der eigene Fahrer noch der fremde sieht ihn in seiner App. Der fremde
-- Fahrer bekommt seine Aufträge ohnehin nur über get_my_external_orders,
-- das die Spalten einzeln aufzählt.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.
alter table public.orders
  add column if not exists client_company text not null default '',
  add column if not exists client_address text not null default '';

alter table public.external_orders
  add column if not exists client_company text not null default '',
  add column if not exists client_address text not null default '';

notify pgrst, 'reload schema';
