-- Zahlungskonditionen (payment terms) become a per-order dropdown choice
-- instead of the fixed "45 Tage netto ... / 14 Tage abzüglich 3 % Skonto"
-- text that used to be hardcoded into the page-3 signoff table — unlike
-- the surrounding AGB/Erklärung/Vereinbarung text, payment terms are a
-- commercial term that varies per deal, not boilerplate law text.
alter table public.external_orders
  add column if not exists payment_terms text not null default '45 Tage netto nach Rechnungserhalt / 14 Tage abzüglich 3 % Skonto';
