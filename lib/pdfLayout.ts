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

/** Mehrzeiliger Text: Zeilenumbrüche aus dem Formular bleiben Zeilenumbrüche. */
export function lines(text: string): string {
  return escapeHtml(text.trim()).replace(/\r?\n/g, '<br/>');
}

/**
 * Eine Zeile "Bezeichnung:   Wert" auf Seite 1. gap ist der Abstand davor in
 * Leerzeilen, wie im Word-Original (0, 1 oder 2). bold setzt die ganze Zeile
 * fett (Lade- und Entladetermin), boldLabel nur die Bezeichnung.
 */
export function fieldRow(
  label: string,
  valueHtml: string,
  options: { gap?: 0 | 1 | 2; bold?: boolean; boldLabel?: boolean } = {}
): string {
  const classes = ['row', options.gap ? `gap${options.gap}` : '', options.bold ? 'b' : '']
    .filter(Boolean)
    .join(' ');
  const labelClass = options.boldLabel ? 'k b' : 'k';
  return `<div class="${classes}"><div class="${labelClass}">${escapeHtml(label)}</div><div class="v">${valueHtml}</div></div>`;
}

/*
 * Gemeinsames <style> für alle erzeugten Dokumente.
 *
 * Alle Maße in Punkt, 1:1 aus dem Word-Original der Firma ausgelesen
 * ("TA.001", als PDF exportiert): Schriftgrößen, Ränder, Spalten und die
 * Grundlinien jeder Zeile. Daraus ergeben sich die Werte unten:
 *
 * Seite 1 — Arial 11,04 pt, Zeilenabstand 12,65 pt (Word "einfach"). Linker
 *   Rand 53,9 pt, Werte stehen in einer Spalte bei 161,9 pt (bei "An Firma"
 *   und "z.H." schon bei 124,7 pt). Zwischen den Zeilen liegen eine oder zwei
 *   Leerzeilen (gap1/gap2). Erste Grundlinie (Datum) 145,4 pt unter der
 *   Blattkante, Titel 192,6 pt, "An Firma" 225,6 pt.
 * Seiten 2 und 3 — Arial 8,04 pt, Zeilenabstand 9,2 pt, Blocksatz, Rand
 *   links 25,6 pt. Einzelne Absätze in 9 pt.
 *
 * Die padding-top-Werte sind die Oberkante der ersten Zeile: Grundlinie
 * minus Abstand Zeilenoberkante–Grundlinie (für Arial bei diesem
 * Zeilenabstand gut 10 pt bzw. 7,4 pt).
 */
export const PDF_STYLES = `
  /* Rand 0: Der Browser druckt seine eigene Kopf- und Fußzeile (Datum, URL)
     in den Seitenrand. Ohne Rand lässt er sie weg; die Ränder stecken im
     padding von .page. Sollte die Zeile trotzdem erscheinen, ist im
     Druckdialog "Kopf- und Fußzeilen" angehakt. */
  @page { size: A4; margin: 0; }
  /* margin:0 ist Pflicht: Der Standardrand des Browsers käme sonst zur
     Seitenhöhe hinzu und schöbe hinter jedes Blatt eine leere Seite. */
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  /* 294mm statt 297mm: Bei exakter Übereinstimmung schiebt schon eine
     Rundung eine fast leere Zusatzseite heraus. */
  .page { position: relative; min-height: 294mm; box-sizing: border-box; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  /* Die Original-Schreibschrift des Firmenpapiers, eingebettet. */
  @font-face { font-family: 'HochreiterBriefkopf'; src: url(data:font/ttf;base64,${BRIEFKOPF_FONT_BASE64}) format('truetype'); }
  /* Kopf und Fuß liegen absolut auf dem Blatt (Koordinaten siehe letterhead/
     footer), left:0 ist die Blattkante, nicht der Innenrand der Seite. */
  .letterhead, .footer { position: absolute; left: 0; display: block; font-family: 'HochreiterBriefkopf', 'Segoe Print', cursive; fill: #000; }
  .letterhead { top: 0; }
  .b { font-weight: 700; }

  /* ---- Seite 1 ---- */
  .page.order { padding: 134.8pt 35.3pt 0 53.9pt; font-size: 11.04pt; line-height: 12.65pt; }
  .dateRow { text-align: right; line-height: 13.6pt; }
  /* Nummer mittig unter dem Datum, der Block selbst rechtsbündig. */
  .dateBlock { display: inline-block; text-align: center; }
  h1.title { margin: 11.6pt 0 0; text-align: center; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 20.04pt; line-height: 24pt; }
  .head { margin-top: 17.85pt; }
  .row { display: flex; }
  .row .k { flex: 0 0 108pt; }
  .head .row .k { flex-basis: 70.8pt; }
  .row .v { flex: 1; min-width: 0; }
  .gap1 { margin-top: 12.65pt; }
  .gap2 { margin-top: 25.3pt; }
  /* "€ 3.000,00" und dahinter "pauschal" an fester Stelle, wie der Tabulator im Original. */
  .amount { display: inline-block; min-width: 72pt; }

  /* ---- Seiten 2 und 3 (Geschäftsbedingungen) ---- */
  .page.legal { padding: 128.3pt 26pt 0 25.6pt; font-size: 8.04pt; line-height: 9.2pt; }
  .page.legal.p3 { padding-top: 137.1pt; }
  .legal p { margin: 0 0 10.4pt; text-align: justify; }
  .legal .size9 { font-size: 9pt; line-height: 10.4pt; }
  /* "Versicherung:" mit hängendem Text, wie im Original. */
  .legal .hang { display: flex; margin: 0 0 9pt; font-size: 9pt; line-height: 10.4pt; text-align: justify; }
  .legal .hang .k { flex: 0 0 84.9pt; font-weight: 700; }
  .legal .hang .v { flex: 1; }
  .legal h2 { margin: 0 0 8pt; font-size: 9pt; line-height: 10.4pt; font-weight: 700; text-align: center; }
  .legal h2.spaced { margin-top: 19pt; }
  .legal .center { text-align: center; }
  /* Unterschrift etwas rechts der Mitte, wie im Original. */
  .signature { padding-left: 110pt; text-align: center; margin-top: 11pt; }
  .signature .name { font-size: 9.96pt; line-height: 11pt; }
  .signature .note { font-size: 6pt; line-height: 7.8pt; font-weight: 700; }
  /* Rücktrittsregel unter der Unterschrift, wo früher "Bitte bestätigen …" stand. */
  .legal .confirmNote { margin-top: 20pt; }
`;
