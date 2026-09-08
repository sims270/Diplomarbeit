import type { Order } from '@/app/services/orderService';
import { isoToGerman } from '@/lib/dateFormat';
import { escapeHtml, footer, formatTimeWindow, letterhead, PDF_STYLES } from '@/lib/pdfLayout';

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
  const today = new Date().toLocaleDateString('de-AT');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<style>
${PDF_STYLES}
</style>
</head>
<body>

  <div class="page">
    ${letterhead}
    <div class="dateRow">Stadlhof, ${today}<br/>Transportnummer ${escapeHtml(order.orderNr)}</div>

    <h1 class="title">TRANSPORTAUFTRAG</h1>

    ${driverUsername ? `<div class="field-row"><span class="field-label">Fahrer:</span> ${escapeHtml(driverUsername)}</div>` : ''}

    <table class="fields">
      <tr><td class="label">Ladetermin:</td><td>${escapeHtml(loadingUntil)}</td></tr>
      <tr><td class="label">Ladestelle:</td><td>${escapeHtml(order.loadingCompany)}<br/>${escapeHtml(order.loadingAddress)}</td></tr>
      <tr><td class="label">Lademeter:</td><td>${escapeHtml(order.loadingMeters)}</td></tr>
      <tr><td class="label">Entladetermin:</td><td>${escapeHtml(unloadingUntil)}</td></tr>
      <tr><td class="label">Entladestelle:</td><td>${escapeHtml(order.unloadingCompany)}<br/>${escapeHtml(order.unloadingAddress)}</td></tr>
    </table>

    ${footer('Seite | 1')}
  </div>

</body>
</html>`;
}
