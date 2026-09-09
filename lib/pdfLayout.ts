/**
 * Shared building blocks for every Transportauftrag-style PDF the app
 * generates — external orders (lib/transportauftragPdf.ts, full letterhead
 * + fixed legal pages) and internal ones (lib/ownOrderPdf.ts, same
 * letterhead/footer/styling, page 1 only). Keeping the letterhead, footer
 * and CSS here means both documents render identically without copying the
 * markup twice.
 *
 * Deliberately framework-free (no RN/expo imports) so it can be rendered
 * and previewed outside the app too (e.g. headless Chromium).
 */

export const COMPANY = {
  name: 'Sascha Hochreiter Transport GmbH',
  addressLine:
    'A-8770 Stadlhof, Bundesstr. 24a, Tel. 0043/3843/27935, Fax 0043/3843/27935-4',
  contactLine: 'info@transportehochreiter.at, www.transportehochreiter.at',
  bankLine1: 'Bankverbindung: Raiffeisenbank Trofaiach-Leoben BLZ: 38460, Kto-Nr.: 9.012.006;',
  bankLine2: 'SWIFT-CODE: RZSTAT2G460; IBAN AT84 3846 0000 0901 2006',
  uid: 'UID Nr.: ATU 66995077',
  gerichtsstand: 'Gerichtsstand Leoben',
  firmenbuch: 'Firmenbuchnr: 374954d',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function nl2p(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

// "von 08:00 bis 19:00 Uhr" when both ends are set, falling back to just
// one end (or nothing) when only that much was filled in.
export function formatTimeWindow(from: string, until: string): string {
  if (from && until) return `von ${from} bis ${until} Uhr`;
  if (until) return `bis ${until} Uhr`;
  if (from) return `ab ${from} Uhr`;
  return '';
}

// Top of every page: just the company name + address/contact lines. The
// surname gets its own script-style span to echo the paper letterhead's
// signature-like logotype (a plain italic font can't fully reproduce that,
// this is the closest a web-safe font stack gets).
export const letterhead = `
  <div class="letterhead">
    <div class="companyName">Sascha <span class="brandName">Hochreiter</span> Transport GmbH</div>
    <hr/>
    <div class="companyLine">${COMPANY.addressLine}</div>
    <div class="companyLine">${COMPANY.contactLine}</div>
  </div>
`;

// Bottom of every page: bank/UID/court/company-register details plus that
// page's number. Deliberately a page footer here rather than matching the
// paper template's actual top placement — chosen this way on purpose.
export function footer(pageLabel: string): string {
  return `
    <div class="footer">
      <div>${COMPANY.bankLine1}</div>
      <div>${COMPANY.bankLine2}</div>
      <div>${COMPANY.uid}</div>
      <div>${COMPANY.gerichtsstand}</div>
      <div>${COMPANY.firmenbuch}</div>
      <div class="pageLabel">${pageLabel}</div>
    </div>
  `;
}

// Shared <style> body for every generated document. Unused selectors
// (e.g. table.signoff for a page-1-only document) are harmless.
export const PDF_STYLES = `
  /* Rand 0 statt 18mm/16mm: Der Browser druckt seine eigene Kopf- und
     Fußzeile (Datum, Uhrzeit, Dokumenttitel, URL) in genau diesen Rand.
     Ohne Rand hat er dafür keinen Platz mehr und lässt sie weg — anders
     ist das per CSS nicht abschaltbar. Die Seitenränder übernimmt dafür
     das padding von .page, das Druckbild bleibt also gleich.
     Sollte die Browser-Zeile trotzdem erscheinen, ist im Druckdialog
     "Kopf- und Fußzeilen" angehakt und muss dort abgewählt werden. */
  @page { size: A4; margin: 0; }
  /* Kept close to the browser default line-height (not the airier 1.4-1.5
     that page 1's spacious form invites) — pages 2/3 pack in a lot of
     dense legal text that already barely fits one A4 page each; a global
     bump there would spill it onto extra pages. */
  /* margin:0 ist Pflicht, seit @page keinen Rand mehr hat: der
     Standardrand des Browsers (8px) käme sonst zur Seitenhöhe hinzu und
     schöbe hinter jedes Blatt eine leere Seite. */
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.25; color: #111; }
  /* Die Seite füllt jetzt das ganze A4-Blatt (297mm) statt nur die Fläche
     innerhalb der alten @page-Ränder — die Ränder stecken im padding.
     Dadurch liegt bottom:0 der Fußzeile wirklich am Blattende und nicht
     mehr rund 30mm darüber.
     294mm statt 297mm lässt bewusst 3mm Luft: bei einer exakten
     Übereinstimmung schiebt schon eine Rundung in der mm->px-Umrechnung
     eine fast leere Zusatzseite heraus. */
  .page { position: relative; min-height: 294mm; box-sizing: border-box; padding: 12mm 16mm 30mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .letterhead { text-align: center; margin-bottom: 10px; }
  .companyName { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 21px; font-weight: 700; }
  .brandName { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 28px; font-weight: 400; vertical-align: -3px; }
  .companyLine { font-size: 9px; line-height: 1.4; }
  hr { border: none; border-top: 1px solid #999; margin: 6px 0 8px; }
  /* left/right auf die Seitenränder gesetzt, weil absolut positionierte
     Elemente sich am padding-*Rand* der Seite ausrichten und das padding
     von .page sonst übersprungen würde — die Fußzeile liefe sonst über
     die volle Blattbreite hinaus. bottom:8mm hält sie am Blattende, aber
     außerhalb des nicht bedruckbaren Randbereichs der meisten Drucker. */
  .footer { position: absolute; left: 16mm; right: 16mm; bottom: 8mm; text-align: center; font-style: italic; font-size: 8px; line-height: 1.4; color: #333; border-top: 1px solid #ccc; padding-top: 6px; }
  .pageLabel { text-align: right; font-style: normal; margin-top: 2px; }
  .dateRow { text-align: right; font-size: 12px; margin: 10px 0 4px; }
  h1.title { text-align: center; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 24px; letter-spacing: 1px; margin: 18px 0 26px; }
  .field-row { margin-bottom: 14px; }
  .field-label { font-weight: 700; display: inline-block; min-width: 110px; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.fields td { vertical-align: top; padding: 6px 0; font-size: 12px; }
  table.fields td.label { font-weight: 700; width: 150px; white-space: nowrap; }
  p { margin: 0 0 10px; text-align: justify; }
  .bold-block { font-weight: 700; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  h2.section { font-weight: 700; text-align: center; margin: 16px 0 8px; }
  .signBlock { margin-top: 18px; }
  .signName { font-family: Georgia, 'Times New Roman', serif; font-style: italic; }
  table.signoff { width: 100%; border-collapse: collapse; margin-top: 16px; border: 1px solid #333; }
  table.signoff td { border: 1px solid #333; padding: 6px 8px; font-size: 11px; }
  table.signoff td.k { font-weight: 700; width: 30%; }
`;
