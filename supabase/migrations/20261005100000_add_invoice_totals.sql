-- Beträge der Rechnung: Nettobetrag, Ust und Rechnungsendbetrag.
--
-- Bisher standen auf der Rechnung nur die Beschriftungen, die Summen trug
-- die Buchhaltung von Hand ein. Jetzt rechnet die App sie aus den Preisen
-- der Positionen und dem Ust-Satz aus — der Chef kann jeden Betrag aber
-- trotzdem überschreiben, etwa wenn mit dem Kunden ein gerundeter
-- Gesamtpreis vereinbart ist.
--
-- null heißt "automatisch": dann wird der Betrag beim Anzeigen und beim
-- Export frisch berechnet (siehe computeTotals in
-- supabase/functions/export-invoice/index.ts und lib/invoiceTotals.ts).
-- Nur ein vom Chef eingetragener Betrag wird gespeichert — so rechnet eine
-- nachträglich geänderte Position die Summe weiterhin mit.
--
-- WICHTIG: gemeinsam mit der neuen Fassung der Edge Function export-invoice
-- einspielen. Die neue Fassung liest diese Spalten und scheitert ohne sie.
alter table public.invoices
  add column if not exists netto_betrag numeric(12, 2),
  add column if not exists ust_betrag numeric(12, 2),
  add column if not exists end_betrag numeric(12, 2);

notify pgrst, 'reload schema';
