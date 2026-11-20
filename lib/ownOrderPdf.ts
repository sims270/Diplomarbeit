import type { Order } from '@/app/services/orderService';
import { dateToIso, isoToGerman } from '@/lib/dateFormat';
import {
  escapeHtml,
  fieldRow,
  footer,
  formatTimeWindow,
  letterhead,
  lines,
  PDF_STYLES,
} from '@/lib/pdfLayout';

/** Firma und Anschrift untereinander; leere Teile fallen weg. */
function place(company: string, address: string): string {
  return [company, address]
    .map((part) => part.trim())
    .filter(Boolean)
    .map(lines)
    .join('<br/>');
}

/**
 * Renders the Transportauftrag PDF for an internal job assigned to the
 * company's own driver — same letterhead/footer/styling as the external
 * carrier version (lib/transportauftragPdf.ts), but only ever page 1: no
 * recipient-company fields (there's no external recipient) and none of the
 * fixed legal pages (those only apply once a job leaves the company).
 */
export function buildOwnOrderHtml(order: Order, driverUsername?: string): string {
  // Dates are stored as plain ISO ('YYYY-MM-DD') from the date picker; the
  // paper template shows the German "TT.MM.JJJJ" form.
  const loadingDateDisplay = order.loadingDate ? isoToGerman(order.loadingDate) : '';
  const unloadingDateDisplay = order.unloadingDate ? isoToGerman(order.unloadingDate) : '';
  const loadingTimeWindow = formatTimeWindow(order.loadingTimeFrom, order.loadingTimeUntil);
  const unloadingTimeWindow = formatTimeWindow(order.unloadingTimeFrom, order.unloadingTimeUntil);
  const loadingUntil = loadingTimeWindow
    ? `${loadingDateDisplay}, ${loadingTimeWindow}`
    : loadingDateDisplay;
  const unloadingUntil = unloadingTimeWindow
    ? `${unloadingDateDisplay}, ${unloadingTimeWindow}`
    : unloadingDateDisplay;
  // "05.10.2026" mit führender Null wie auf dem Firmenpapier —
  // toLocaleDateString('de-AT') ließe sie weg ("5.10.2026").
  const today = isoToGerman(dateToIso(new Date()));

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<style>
${PDF_STYLES}
</style>
</head>
<body>

  <div class="page order">
    ${letterhead}
    <div class="dateRow"><span class="dateBlock">Stadlhof, ${today}<br/>Transportnummer ${escapeHtml(order.orderNr)}</span></div>

    <h1 class="title">TRANSPORTAUFTRAG</h1>

    <!-- Gleiches Raster wie der Fremdauftrag (lib/transportauftragPdf.ts). -->
    <div class="head">
      ${driverUsername ? fieldRow('Fahrer:', escapeHtml(driverUsername)) : ''}
    </div>

    ${fieldRow('Ladetermin:', escapeHtml(loadingUntil), { gap: driverUsername ? 2 : 0, bold: true })}
    ${fieldRow('Ladestelle:', place(order.loadingCompany, order.loadingAddress), { gap: 1 })}
    ${order.referenceNumber.trim() ? fieldRow('Referenznummer:', lines(order.referenceNumber), { gap: 2 }) : ''}
    ${fieldRow('Ladegut:', place(order.cargoDescription, order.loadingMeters), { gap: 2 })}
    ${fieldRow('Entladetermin:', escapeHtml(unloadingUntil), { gap: 2, bold: true })}
    ${fieldRow('Entladestelle:', place(order.unloadingCompany, order.unloadingAddress), { gap: 2 })}

    ${footer('Seite | 1')}
  </div>

</body>
</html>`;
}
