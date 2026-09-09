-- Zahlungskonditionen (payment terms) become a per-order dropdown choice
-- instead of the fixed "45 Tage netto ... / 14 Tage abzüglich 3 % Skonto"
-- text that used to be hardcoded into the page-3 signoff table — unlike
-- the surrounding AGB/Erklärung/Vereinbarung text, payment terms are a
-- commercial term that varies per deal, not boilerplate law text.
--
-- Der Standardwert ist die erste Kondition aus PAYMENT_TERMS_OPTIONS
-- (lib/transportauftragPdf.ts). Diese Liste ist wortwörtlich aus dem
-- Warenwirtschaftssystem der Firma übernommen; ein Default, der dort nicht
-- vorkommt, stünde sonst in Aufträgen, die über keine der auswählbaren
-- Konditionen erklärbar wären.
alter table public.external_orders
  add column if not exists payment_terms text not null
  default 'Zahlbar innerhalb 45 Tagen netto';

-- "add column if not exists" fasst eine bereits vorhandene Spalte nicht
-- mehr an — auf einer Datenbank, die diese Migration schon mit dem alten
-- Default ausgeführt hat, bliebe der alte Text sonst stehen. Deshalb den
-- Default getrennt und unbedingt setzen.
alter table public.external_orders
  alter column payment_terms set default 'Zahlbar innerhalb 45 Tagen netto';

-- Bestehende Aufträge behalten ihre Kondition: sie dokumentieren, was
-- damals tatsächlich vereinbart wurde, und werden hier bewusst nicht
-- überschrieben.

-- PostgREST cached den Spaltenkatalog. Ohne diesen Anstoß meldet der
-- Client "Could not find the 'payment_terms' column of 'external_orders'
-- in the schema cache", bis der Cache von selbst neu lädt.
notify pgrst, 'reload schema';
