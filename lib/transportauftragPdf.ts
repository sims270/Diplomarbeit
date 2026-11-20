import type { ExternalOrder } from '@/app/services/externalOrderService';
import { dateToIso, isoToGerman } from '@/lib/dateFormat';
import {
  escapeHtml,
  fieldRow,
  footer,
  formatTimeWindow,
  letterhead,
  lines,
  nl2p,
  PDF_STYLES,
} from '@/lib/pdfLayout';

/**
 * Renders the "Transportauftrag" (transport order) PDF for subcontracted
 * carriers ("fremde LKW"), matching the company's real Word template
 * ("TA.001") in layout, font sizes and spacing — see PDF_STYLES in
 * lib/pdfLayout.ts for the measured values. Page 1 carries the
 * order-specific fields; pages 2 and 3 are the fixed terms and must stay
 * word-for-word identical on every generated order — do not parametrize
 * any of that text.
 *
 * The page-3 table (Zahlungsziel, Kennzeichen, Fahrer, Unterschrift) was
 * dropped on the company's request: that is handled in the app now. The
 * Zahlungsziel (order.paymentTerms) moved to page 1, below Terminzuschlag.
 *
 * Deliberately framework-free (no RN/expo imports) so buildTransportauftragHtml
 * can be rendered and previewed outside the app too (e.g. headless Chromium).
 * The actual print/share flow lives in lib/transportauftragExport.ts.
 * Letterhead/footer/styling shared with lib/ownOrderPdf.ts via lib/pdfLayout.ts.
 */

// Dropdown options for "Transportmittel", taken from the company's existing
// Word template.
export const VEHICLE_TYPE_OPTIONS = [
  '13,60 m Tautliner',
  '13,60 m Planensattel',
  '13,20 m Kühl-/Koffer-LKW',
  '6 m Planenmotorwagen',
  'offener LKW 13,60 m',
  '13,60 Planensattel oder offener LKW',
  'Siehe Sonstiges',
  'Diverse',
  '6 + 8 m Planenhängerzug',
  '12,60 m Planensattel',
  '6 + 9 m Jumbohängerzug',
  '13,60 m Planenjumbosattel',
  '7 + 7 m Planenhängerzug',
  'SILO-LKW sauberst gereinigt',
  '7 m Planenmotorwagen',
  'Motorwagen m. Hebebühne',
  'KIPP-LKW',
  '7,65 + 7,65 M Hängerzug',
  'Klein-LKW m. Hebebühne',
];

// Dropdown-Optionen für "Zahlungskonditionen" — die Konditionen aus dem
// Warenwirtschaftssystem der Firma (Maske "Kondition suchen", Firma 219430),
// wortwörtlich und in derselben Reihenfolge übernommen. Der Wortlaut muss
// mit dem System übereinstimmen, damit Transportauftrag und Buchhaltung
// dieselbe Kondition auch gleich benennen.
//
// Anders als der AGB-/Erklärungs-/Vereinbarungstext auf Seite 2 und 3 ist
// das eine kaufmännische Vereinbarung, die pro Auftrag unterschiedlich
// ausfällt — deshalb wählbar statt fest verdrahtet.
export const PAYMENT_TERMS_OPTIONS = [
  'Zahlbar innerhalb 45 Tagen netto',
  'Zahlbar innerhalb von 10 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 14 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 30 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 45 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 60 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 90 Tagen netto ohne Abzug',
  'Innerhalb von 8 Tagen 2 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 10 Tagen 3 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 10 Tagen 3 % Skonto, 60 Tage ohne Abzug',
  'Innerhalb von 14 Tagen 2 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 14 Tagen 3 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 30 Tagen 3 % Skonto, 60 Tage ohne Abzug',
  'Innerhalb von 7 Tagen 3 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 10 Tagen 2 % Skonto, 30 Tage ohne Abzug',
  'Innerhalb von 14 Tagen 3 % Skonto, 14 Tage ohne Abzug',
  'Zahlbar innerhalb von 7 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 40 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 21 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 42 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 50 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 8 Tagen netto ohne Abzug',
  'Zahlbar innerhalb von 20 Tagen netto ohne Abzug',
  'Innerhalb von 8 Tagen 3 % Skonto, 30 Tage ohne Abzug',
  'Zahlbar innerhalb von 5 Tagen netto ohne Abzug',
];

// Feste Geschäftsbedingungen — Seite 2. Wortlaut vom Firmenpapier; ändern
// darf ihn nur die Firma selbst (zuletzt am 19.11.2026: neuer Satz zum
// fehlenden Ladungssicherungsmaterial, die Bearbeitungsgebühr von 20 € steht
// nur noch dort statt bei den EUR-Paletten). Nie Auftragsdaten hineinschreiben.
// Zwischen "€" und Betrag steht ein geschütztes Leerzeichen (U+00A0), damit
// der Blocksatz das Eurozeichen nicht ans Zeilenende vom Betrag trennt.
const PAGE_2_TERMS = nl2p(`
Lademitteltausch gilt als vereinbart. Weiters sind alle Lademitteltätigkeiten von Ihnen schriftlich festzuhalten und die Nachweise müssen Sie an uns senden. Bei einer Lademittelschuld verpflichten Sie sich, diese bei den jeweiligen Firmen zu Ihren Lasten innerhalb von 14 Tagen auszugleichen. Sollte dies nicht der Fall sein, werden wir Ihnen die Lademittel in Rechnung stellen und bei der Frachtrechnung sofort berücksichtigen. Bei einer Rückführung durch uns, haben Sie die Kosten zu tragen. Lademittel müssen bei Tausch oder Schuldausgleich im einwandfreien Zustand sein. Nicht getauschte EUR-Paletten werden an Sie in Höhe von Euro 15,-- exkl. MWSt. verrechnet. Fehlendes Ladungssicherungsmaterial wird in Rechnung gestellt – Zurrgurte € 25,00/Stk., Antirutschmatten € 2,50/Stk., Überlängentafel € 45,00/Stk. – zuzüglich der Bearbeitungsgebühr von € 20,00 exkl. MWSt. 24 Stunden standgeldfrei für Verzollung und für die Be-/ Entladung! Es werden nur Standgeldkosten in Höhe von Euro 180,-- akzeptiert, wenn die 24 Stunden überschritten werden!

Im Falle einer nachträglichen Stornierung oder Nichtübernahme Ihrerseits sind Sie zur Beschaffung eines Ersatzfahrzeuges verpflichtet bzw. tragen den etwaigen Mehraufwand, der uns bei der Beschaffung eines Ersatzfahrzeuges entsteht.

Die bestätigten CMR-Frachtbriefe, Liefer- und Lademittelscheine sind innerhalb von 5 Werktagen nach Entladung an uns zu mailen (E-Mail: info@transportehochreiter.at). Sollten die Ablieferbelege nicht rechtzeitig übermittelt werden, erfolgt eine Kürzung der Fracht um € 50,00.

Die Frachtrechnung wird nur mit best. CMR-Frachtbriefen, Liefer- und Lademittelscheinen anerkannt.
`);

const PAGE_2_VERSICHERUNG = `
  <div class="hang"><div class="k">Versicherung:</div><div class="v">Gemäß CMR durch Sie zu Ihren Lasten, wobei die Haftung nach Art 29 CMR mitversichert ist und der Versicherungsumfang mindestens Euro 364.000,-- beträgt.</div></div>
`;

const PAGE_2_REST = nl2p(`
Sie wurden von uns auf Lade- bzw. Entladetermine hingewiesen, haben diese akzeptiert, und werden daher bei Nichteinhaltung dieser von uns voll haftbar gemacht.
`);

const PAGE_2_ERKLAERUNG = `
  <p class="b">Für Transporte von, nach, durch und innerhalb von Deutschland gilt:</p>
${nl2p(`
Wenn der Fahrer nicht Angehöriger eines EU-/EWR-Staates ist, muss er gemäß dem deutschen Gesetz zur Bekämpfung der illegalen Beschäftigung im gewerblichen Güterkraftverkehr in Deutschland eine Arbeitsgenehmigung im Original zusammen mit einer beglaubigten Übersetzung in deutscher Sprache bzw. eine amtliche Bescheinigung einer beglaubigten Übersetzung, dass für den Fahrer eine Genehmigung nicht erforderlich ist, mitführen.

Der Auftragnehmer stellt sicher, dass die Leistungen im Rahmen der für ihn und seine Erfüllungsgehilfen geltenden rechtlichen Bestimmungen, insbesondere unter Beachtung der Arbeitszeitregelungen für Fahrpersonal (Sozialvorschriften), durchgeführt werden. Der Auftragnehmer stellt insbesondere sicher, dass er und Nachunternehmer – soweit anwendbar – die Pflicht zur Zahlung des Mindestlohnes gemäß § 20 MiLoG einhalten, gemäß § 16 MiLoG eine schriftliche Anmeldung vor Beginn jeder Dienstleistung in deutscher Sprache bei der zuständigen Zollbehörde vorlegen und gemäß § 17 MiLoG Beginn, Ende und Dauer der täglichen Arbeitszeit seiner Arbeitnehmer/innen spätestens bis zum Ablauf des siebten auf den Tag der Arbeitsleistung folgenden Kalendertages (oder rechtzeitig) aufzeichnen und diese Aufzeichnungen mindestens zwei Jahre beginnend ab dem für die Aufzeichnung maßgeblichen Zeitpunkt aufbewahren. Der Auftragnehmer versichert, dass er in der Vergangenheit nicht wegen Verstößen gegen diese oder andere gesetzliche Verpflichtungen (soweit auf ihn bereits anwendbar) im Bereich von Lohnzahlungen behördlich oder gerichtlich sanktioniert wurde, insbesondere in diesem Zusammenhang nicht von öffentlichen Aufträgen ausgeschlossen worden ist. Der Auftragnehmer wird es dem Auftraggeber sofort anzeigen, falls solche Verstöße bzw. Ausschlüsse während der Vertragslaufzeit auftreten sollen. Ferner schließt der Auftragnehmer gleichlautende oder zumindest sinngemäße Vereinbarungen mit seinen Nachunternehmern (Unterfrachtführern) ab und zahlt diesen Vergütungen, die eine Zahlung des Mindestlohnes an ihre Arbeitnehmer ermöglichen.

Der Auftragnehmer erklärt, dass der Auftraggeber bei jeglicher Zuwiderhandlung schadlos gehalten wird. Das heißt, dass der Auftraggeber im Innenverhältnis für jeden Fall eines möglichen Gesetzesverstoßes von Ersatzansprüchen Dritter rechtsverbindlich freigestellt wird.
`)}`;

const PAGE_2_VEREINBARUNG = nl2p(`
In verschiedensten EU-Staaten gelten zwingende Vorschriften zur Einhaltung der Meldepflichten sowie zur Bezahlung des Mindestlohns. Teilweise sehen gesetzliche Bestimmungen bei einer Unterentlohnung eine verschuldensunabhängige Unternehmerhaftung sowie strafrechtliche Sanktionen vor. Der Auftragnehmer ist verpflichtet, seine Mitarbeiter und sonstigen Erfüllungsgehilfen, insbesondere Subunternehmer, nachweislich (schriftlich) von der Verpflichtung zur Einhaltung der jeweiligen Mindestlohn-Bestimmungen zu unterrichten und sich mit der Sorgfalt eines ordentlichen Unternehmers davon zu überzeugen, dass diese auch tatsächlich befolgt werden. Auf Verlagen hat der Auftragnehmer dem Auftraggeber entsprechende Nachweise zur Einhaltung dieser gesetzlichen Bestimmungen unverzüglich und kostenfrei vorzulegen. Der Auftragnehmer verpflichtet sich, den Auftraggeber hinsichtlich aller Aufwendungen, Kosten, Ansprüche und Forderungen (unabhängig vom Rechtsgrund und verschuldensunabhängig), die im Zusammenhang mit der Verletzung dieser Vereinbarung oder Nichteinhaltung von Mindestlohn-Bestimmungen (inklusive den dazu erlassenen Verordnungen) entstehen, vollumfänglich, d. h. auch der Höhe nach unbeschränkt, schad- und klaglos zu halten. Das gilt insbesondere auch für das Entstehen von Verwaltungskosten, etc. Der Auftragnehmer haftet für alle seine Subunternehmer.
`);

// Feste Geschäftsbedingungen — Seite 3. Wortlaut vom Firmenpapier.
const PAGE_3_TOP = nl2p(`
Ihr Fahrzeug muss sich im einwandfreien Zustand befinden und bei ADR-Gut nach gesetzlichen Bestimmungen ausgerüstet sein. Sämtliche Sicherheitsvorschriften unserer Kunden, wie das Tragen von Sicherheitsausrüstung und Ladegutsicherung sind einzuhalten! Das Fahrzeug muss mit ausreichendem Ladesicherungsmaterial (Gurte, Kantenschoner usw.) ausgerüstet sein. Stehzeiten sind uns sofort zu melden und müssen schriftlich festgehalten werden. Weiters müssen auch Schäden an der Ware bzw. Verlust sofort gemeldet werden. Bei Verzögerungen oder Schwierigkeiten müssen wir ebenfalls sofort informiert werden. Sie haben Sorge zu tragen, dass das zulässige Gesamtgewicht des LKW nicht überschritten wird, da wir keine Kosten für Überladung usw. übernehmen. Der Fahrer muss bei der Verladung anwesend sein und hat für eine ordnungsgemäße Beladung zu sorgen. Um- bzw. Beiladung ist nur mit unserer schriftlichen Genehmigung möglich. Weiters dürfen Ruhepausen ausschließlich nur auf bewachten Ruheplätzen durchgeführt werden. Bei Ausfall des Fahrzeuges sind Sie verpflichtet einen Ersatz-LKW zu organisieren.

Dem Auftragnehmer obliegt es, zu gewährleisten, dass der die Beförderung durchführende Fahrzeuglenker über eine gültige Lenkerberechtigung verfügt und die erforderliche körperliche und geistige Eignung besitzt.
`);

const PAGE_3_AUSLAENDERBESCHAEFTIGUNG = `
  <p><u><strong>Ausländerbeschäftigungsgesetz:</strong></u> Für die Annahme und Durchführung des Transportes gilt bei österreichischen Subunternehmern als fix vereinbart, dass der Lenker des Fahrzeuges eine Arbeits- und Aufenthaltsbewilligung für Österreich besitzt. Sollte dies nicht der Fall sein, gilt der Transportauftrag als nicht erteilt und sind wir zu informieren!</p>
`;

const PAGE_3_REST = nl2p(`
Das Inkasso von Forderungen durch Dritte (z.B. Banken) ist nicht zulässig. Sie erklären sich mit der Kompensation bzw. Aufrechnung von Forderungen und Verbindlichkeiten jeder Art einverstanden. Die Abtretung der Geldforderungen ist nur mit unserer ausdrücklichen Zustimmung zulässig!
`);

const PAGE_3_KUNDENSCHUTZ = `
  <p class="b size9">KUNDENSCHUTZ GILT ALS VEREINBART! Beim Eintritt in den Wettbewerb, verfallen Ihre Frachtrechte und es wird eine Haftbarmachung in Höhe von Euro 10.000,-- verrechnet!</p>
  <p class="b size9 center">Wir arbeiten ausschließlich nach den CMR-Bedingungen neuester Fassung.</p>
`;

// Die Tabelle "Zahlungsziel / Kennzeichen / Fahrer / Unterschrift" ist
// weggefallen: Kennzeichen und Fahrer trägt der Frächter in der App ein und
// bestätigt dort auch (20261119190000_external_order_confirmation.sql). An
// ihrer Stelle steht die Rücktrittsregel, die die App durchsetzt.
const PAGE_3_CLOSING = `
  <p class="size9 center">In Erwartung einer zuverlässigen, ordnungsgemäßen und termingerechten Transportdurchführung verbleiben wir<br/>mit freundlichen Grüßen</p>
  <div class="signature">
    <div class="name">Sascha Hochreiter</div>
    <div class="note">(Gültig ohne Unterschrift - erstellt durch Fax-Computer)</div>
  </div>
  <p class="size9 b center confirmNote">Bitte bestätigen Sie den Transportauftrag in der App bzw. per E-Mail. Ein Rücktritt ist nur innerhalb einer Stunde nach der Bestätigung möglich, danach ist der Auftrag verbindlich.</p>
`;

/** Firma und Anschrift untereinander; leere Teile fallen weg. */
function place(company: string, address: string): string {
  return [company, address]
    .map((part) => part.trim())
    .filter(Boolean)
    .map(lines)
    .join('<br/>');
}

/**
 * Betrag wie im Original: "3.000,00" — mit Tausenderpunkt und zwei
 * Kommastellen, egal wie er im Formular steht ("3000", "3000,5",
 * "3.000", "3000.50"). Leer heißt 0,00. Was sich nicht als Zahl lesen
 * lässt (etwa "nach Vereinbarung"), bleibt unverändert stehen.
 *
 * Selbst formatiert statt toLocaleString: Das HTML entsteht auch am Handy
 * (Hermes), und dort ist auf deutsche Zahlenformate kein Verlass.
 */
export function formatEuro(raw: string): string {
  const input = raw.trim().replace(/\s/g, '').replace(/^€/, '');
  if (!input) return '0,00';

  let normalized: string;
  if (input.includes(',')) {
    // Komma = Dezimaltrennzeichen, Punkte sind Tausenderpunkte.
    normalized = input.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(input)) {
    // "3.000" oder "1.250.000": nur Tausenderpunkte.
    normalized = input.replace(/\./g, '');
  } else {
    // "3000" oder "3000.50" (Punkt als Dezimalpunkt).
    normalized = input;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return raw.trim();

  const cents = Math.round(Number(normalized) * 100);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')}`;
}

/** "€ 3.000,00   pauschal" fett, dahinter der Rest normal — wie im Original. */
function price(amount: string, tail: string): string {
  return `<span class="b"><span class="amount">€ ${escapeHtml(formatEuro(amount))}</span>pauschal</span>${tail}`;
}

export function buildTransportauftragHtml(order: ExternalOrder): string {
  // Dates are stored as plain ISO ('YYYY-MM-DD') from the date picker;
  // the paper template shows the German "TT.MM.JJJJ" form.
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
  const cargo = place(order.cargoDescription, order.loadingMeters);

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
    <div class="dateRow"><span class="dateBlock">Stadlhof, ${today}<br/>Nr. ${escapeHtml(order.orderNr)}</span></div>

    <h1 class="title">TRANSPORTAUFTRAG</h1>

    <!-- Empfänger: Firma mit Anschrift darunter in derselben Spalte, "z.H."
         als eigene Zeile. Fehlt die Anschrift, fällt sie weg. -->
    <div class="head">
      ${fieldRow('An Firma:', place(order.recipientCompany, order.recipientAddress))}
      ${fieldRow('z.H.:', lines(order.recipientContact), { gap: 1 })}
    </div>
    <div class="gap1">Wie bereits telefonisch mit Ihnen vereinbart, übernehmen Sie in unserem Auftrag folgenden Transport:</div>

    ${fieldRow('Ladetermin:', escapeHtml(loadingUntil), { gap: 2, bold: true })}
    ${fieldRow('Ladestelle:', place(order.loadingCompany, order.loadingAddress), { gap: 1 })}
    ${fieldRow('Referenznummer:', lines(order.loadingNumber), { gap: 2 })}
    ${fieldRow('Ladegut:', cargo, { gap: 1 })}
    ${fieldRow('Entladetermin:', escapeHtml(unloadingUntil), { gap: 2, bold: true })}
    ${fieldRow('Entladestelle:', place(order.unloadingCompany, order.unloadingAddress), { gap: 2 })}
    ${fieldRow('Frachtsatz:', price(order.freightRate, ' (inkl. allen Mauten, Nebenspesen u. Unterwegskosten).'), { gap: 2, boldLabel: true })}
    ${fieldRow('Terminzuschlag:', price(order.deadlineSurcharge, ''), { boldLabel: true })}
    ${order.paymentTerms.trim()
      ? fieldRow('Zahlungsziel:', lines(order.paymentTerms.replace(/ \/ /g, '\n')), { boldLabel: true })
      : ''}
    ${fieldRow('Transportmittel:', lines(order.vehicleType), { gap: 1, boldLabel: true })}
    ${fieldRow('Sonstiges:', lines(order.notes), { gap: 1, boldLabel: true })}

    ${footer('Seite | 1')}
  </div>

  <div class="page legal">
    ${letterhead}
    ${PAGE_2_TERMS}
    ${PAGE_2_VERSICHERUNG}
    ${PAGE_2_REST}
    <h2>Erklärung</h2>
    ${PAGE_2_ERKLAERUNG}
    <h2 class="spaced">Vereinbarung</h2>
    ${PAGE_2_VEREINBARUNG}
    ${footer('Seite | 2')}
  </div>

  <div class="page legal p3">
    ${letterhead}
    ${PAGE_3_TOP}
    ${PAGE_3_AUSLAENDERBESCHAEFTIGUNG}
    ${PAGE_3_REST}
    ${PAGE_3_KUNDENSCHUTZ}
    ${PAGE_3_CLOSING}
    ${footer('Seite | 3')}
  </div>

</body>
</html>`;
}
