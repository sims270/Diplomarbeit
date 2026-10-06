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

import { BRIEFKOPF_FONT_BASE64 } from './briefkopfFont';

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

/*
 * Briefkopf und Brieffuß 1:1 vom Firmenpapier übernommen — Vorlage ist ein
 * echter Transportauftrag der Firma (Word-Dokument als PDF, "TA.558").
 * Aus dessen Seitenbeschreibung stammen alle Zahlen unten: Schriftgrößen,
 * Grundlinien und die Linie unter dem Namen, in Punkt (1/72 Zoll) von der
 * oberen Blattkante gemessen. Die Schrift ist die eingebettete
 * Original-Schreibschrift (lib/briefkopfFont.ts).
 *
 * Gezeichnet als SVG, nicht als HTML-Text: In einem SVG sitzt jede Zeile
 * exakt auf ihrer Grundlinie, unabhängig von Zeilenhöhen und Rändern — so
 * liegt der Kopf auf jedem Gerät an genau derselben Stelle wie im Original.
 * Die viewBox ist das A4-Blatt in Punkt (595,32 x 841,92), das SVG selbst
 * so breit wie das Blatt.
 */
const PAGE_WIDTH_PT = 595.32;
const PAGE_HEIGHT_PT = 841.92;
/** Mitte des Textbereichs im Original (Ränder 52,44 pt links, 35,30 pt rechts) — dort ist zentriert. */
const CENTER_X = 306.23;
const RIGHT_X = 560.02;

/** Kopfbereich: obere 110 pt des Blatts. */
const HEADER_HEIGHT_PT = 110;
/** Fußbereich: von 731,92 pt bis 800 pt — endet sicher vor dem Seitenende (siehe .page). */
const FOOTER_TOP_PT = 731.92;
const FOOTER_HEIGHT_PT = 68.08;

const ptToMm = (pt: number) => `${((pt * 25.4) / 72).toFixed(2)}mm`;

export const letterhead = `
  <svg class="letterhead" xmlns="http://www.w3.org/2000/svg"
       viewBox="0 0 ${PAGE_WIDTH_PT} ${HEADER_HEIGHT_PT}"
       style="width:${ptToMm(PAGE_WIDTH_PT)};height:${ptToMm(HEADER_HEIGHT_PT)}">
    <text x="${CENTER_X}" y="60.36" text-anchor="middle" font-size="15.96">Sascha <tspan font-size="20.04">Hochreiter</tspan> Transport GmbH</text>
    <rect x="52.44" y="79.58" width="507.58" height="0.48" fill="#000"/>
    <text x="${CENTER_X}" y="87.62" text-anchor="middle" font-size="8.04">${COMPANY.addressLine}</text>
    <text x="${CENTER_X}" y="102.5" text-anchor="middle" font-size="8.04">${COMPANY.contactLine}</text>
  </svg>
`;

export function footer(pageLabel: string): string {
  // Grundlinien der fünf Zeilen und der Seitenzahl, wie im Original.
  const lines: [string, number][] = [
    [COMPANY.bankLine1, 743.28],
    [COMPANY.bankLine2, 753.24],
    [COMPANY.uid, 763.08],
    [COMPANY.gerichtsstand, 773.04],
    [COMPANY.firmenbuch, 783.0],
  ];
  return `
    <svg class="footer" xmlns="http://www.w3.org/2000/svg"
         viewBox="0 ${FOOTER_TOP_PT} ${PAGE_WIDTH_PT} ${FOOTER_HEIGHT_PT}"
         style="top:${ptToMm(FOOTER_TOP_PT)};width:${ptToMm(PAGE_WIDTH_PT)};height:${ptToMm(FOOTER_HEIGHT_PT)}">
      ${lines
        .map(([text, y]) => `<text x="${CENTER_X}" y="${y}" text-anchor="middle" font-size="8.04">${text}</text>`)
        .join('\n      ')}
      <text x="${RIGHT_X}" y="792.84" text-anchor="end" font-size="8.04">${escapeHtml(pageLabel)}</text>
    </svg>
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
  /* Oben 40mm: Platz für den Briefkopf (letzte Zeile bei 36,2mm) plus Abstand.
     Unten 36mm: Der Brieffuß beginnt bei rund 260mm, der Text der Seite
     muss davor enden (294mm - 36mm = 258mm). */
  .page { position: relative; min-height: 294mm; box-sizing: border-box; padding: 40mm 16mm 36mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  /* Die AGB-Seiten 2 und 3 des Transportauftrags: dichter Text, der mit dem
     Original-Briefkopf genau eine Seite füllt — eine Spur kleiner gesetzt,
     damit er auch bei leicht anderen Schriftmaßen (iOS/Android) nicht auf
     eine vierte Seite rutscht. */
  .page.legal { font-size: 10.5px; }
  /* Die Original-Schreibschrift des Firmenpapiers, eingebettet. */
  @font-face { font-family: 'HochreiterBriefkopf'; src: url(data:font/ttf;base64,${BRIEFKOPF_FONT_BASE64}) format('truetype'); }
  /* Kopf und Fuß liegen absolut auf dem Blatt (Koordinaten siehe letterhead/
     footer), left:0 ist die Blattkante, nicht der Innenrand der Seite. */
  .letterhead, .footer { position: absolute; left: 0; display: block; font-family: 'HochreiterBriefkopf', 'Segoe Print', cursive; fill: #000; }
  .letterhead { top: 0; }
  hr { border: none; border-top: 1px solid #999; margin: 6px 0 8px; }
  .dateRow { text-align: right; font-size: 12px; margin: 10px 0 4px; }
  /* Nummer mittig unter dem Datum, der Block selbst rechtsbündig — wie auf dem Firmenpapier. */
  .dateBlock { display: inline-block; text-align: center; }
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
