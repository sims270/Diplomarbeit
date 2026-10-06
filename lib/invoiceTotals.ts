/**
 * Die Beträge unter den Positionen einer Rechnung: Nettobetrag, Ust und
 * Rechnungsendbetrag.
 *
 * Jeder Betrag ist entweder ausgerechnet oder vom Chef eingetragen (null =
 * ausrechnen). Ein eingetragener Betrag rechnet nach unten weiter: ein
 * geänderter Nettobetrag ändert auch Ust und Endbetrag, solange die nicht
 * ebenfalls eingetragen sind.
 *
 * Dieselbe Rechnung steht in supabase/functions/export-invoice/index.ts
 * (computeTotals) — die Edge Function läuft unter Deno und kann dieses
 * Modul nicht importieren. Bei einer Änderung beide anpassen.
 */
export interface InvoiceTotals {
  netto: number | null;
  ust: number | null;
  end: number | null;
}

/** Auf Cent runden — Geldbeträge haben auf der Rechnung zwei Stellen. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeInvoiceTotals(
  prices: (number | null)[],
  ustSatz: number | null,
  manual: InvoiceTotals
): InvoiceTotals {
  // Ohne einen einzigen Preis gibt es nichts zu summieren — dann bleibt der
  // Betrag leer, statt eine Rechnung über 0,00 € zu behaupten.
  const known = prices.filter((price): price is number => price !== null);
  const netto = manual.netto ?? (known.length > 0 ? roundCents(known.reduce((a, b) => a + b, 0)) : null);

  const ust =
    manual.ust ?? (netto !== null && ustSatz !== null ? roundCents((netto * ustSatz) / 100) : null);

  const end = manual.end ?? (netto !== null ? roundCents(netto + (ust ?? 0)) : null);

  return { netto, ust, end };
}

/** "1.395,00" — so, wie der Betrag auch auf der Rechnung steht. */
export function formatAmount(value: number | null): string {
  if (value === null) return '';
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
