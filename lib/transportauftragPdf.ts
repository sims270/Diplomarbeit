import type { ExternalOrder } from '@/app/services/externalOrderService';
import { isoToGerman } from '@/lib/dateFormat';
import { escapeHtml, footer, formatTimeWindow, letterhead, nl2p, PDF_STYLES } from '@/lib/pdfLayout';

/**
 * Renders the "Transportauftrag" (transport order) PDF for subcontracted
 * carriers ("fremde LKW"), matching the company's real paper template 1:1.
 * Page 1 carries the order-specific fields; pages 2 and 3 are the fixed
 * legal terms and MUST stay word-for-word identical on every generated
 * order — do not parametrize any of that text.
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

// Fixed legal terms — page 2. Verbatim from the paper template. Never
// interpolate order data into this text.
const PAGE_2_TERMS = nl2p(`
Lademitteltausch gilt als vereinbart. Weiters sind alle Lademitteltätigkeiten von Ihnen schriftlich festzuhalten und die Nachweise müssen Sie an uns senden. Bei einer Lademittelschuld verpflichten Sie sich, diese bei den jeweiligen Firmen zu Ihren Lasten innerhalb von 14 Tagen auszugleichen. Sollte dies nicht der Fall sein, werden wir Ihnen die Lademittel in Rechnung stellen und bei der Frachtrechnung sofort berücksichtigen. Bei einer Rückführung durch uns, haben Sie die Kosten zu tragen. Lademittel müssen bei Tausch oder Schuldausgleich im einwandfreien Zustand sein. Nicht getauschte EUR-Paletten werden an Sie in Höhe von Euro 15,-- und einer pauschalen Bearbeitungsgebühr von Euro 7,-- exkl. MWSt. verrechnet. 24 Stunden standgeldfrei für Verzollung und für die Be-/ Entladung! Es werden nur Standgeldkosten in Höhe von Euro 180,-- akzeptiert, wenn die 24 Stunden überschritten werden!

Im Falle einer nachträglichen Stornierung oder Nichtübernahme Ihrerseits sind Sie zur Beschaffung eines Ersatzfahrzeuges verpflichtet bzw. tragen den etwaigen Mehraufwand, der uns bei der Beschaffung eines Ersatzfahrzeuges entsteht.

Die bestätigten CMR-Frachtbriefe, Liefer- und Lademittelscheine sind innerhalb von 5 Werktagen nach Entladung an uns zu mailen (E-Mail: info@transportehochreiter.at). Sollten die Ablieferbelege nicht rechtzeitig übermittelt werden, erfolgt eine Kürzung der Fracht um € 50,00.

Die Frachtrechnung wird nur mit best. CMR-Frachtbriefen, Liefer- und Lademittelscheinen anerkannt.
`);

const PAGE_2_VERSICHERUNG = `
  <p><strong>Versicherung:</strong> Gemäß CMR durch Sie zu Ihren Lasten, wobei die Haftung nach Art 29 CMR mitversichert ist und der Versicherungsumfang mindestens Euro 364.000,-- beträgt.</p>
`;

const PAGE_2_REST = nl2p(`
Sie wurden von uns auf Lade- bzw. Entladetermine hingewiesen, haben diese akzeptiert, und werden daher bei Nichteinhaltung dieser von uns voll haftbar gemacht.
`);

const PAGE_2_ERKLAERUNG = nl2p(`
Für Transporte von, nach, durch und innerhalb von Deutschland gilt:

Wenn der Fahrer nicht Angehöriger eines EU-/EWR-Staates ist, muss er gemäß dem deutschen Gesetz zur Bekämpfung der illegalen Beschäftigung im gewerblichen Güterkraftverkehr in Deutschland eine Arbeitsgenehmigung im Original zusammen mit einer beglaubigten Übersetzung in deutscher Sprache bzw. eine amtliche Bescheinigung einer beglaubigten Übersetzung, dass für den Fahrer eine Genehmigung nicht erforderlich ist, mitführen.

Der Auftragnehmer stellt sicher, dass die Leistungen im Rahmen der für ihn und seine Erfüllungsgehilfen geltenden rechtlichen Bestimmungen, insbesondere unter Beachtung der Arbeitszeitregelungen für Fahrpersonal (Sozialvorschriften), durchgeführt werden. Der Auftragnehmer stellt insbesondere sicher, dass er und Nachunternehmer – soweit anwendbar – die Pflicht zur Zahlung des Mindestlohnes gemäß § 20 MiLoG einhalten, gemäß § 16 MiLoG eine schriftliche Anmeldung vor Beginn jeder Dienstleistung in deutscher Sprache bei der zuständigen Zollbehörde vorlegen und gemäß § 17 MiLoG Beginn, Ende und Dauer der täglichen Arbeitszeit seiner Arbeitnehmer/innen spätestens bis zum Ablauf des siebten auf den Tag der Arbeitsleistung folgenden Kalendertages (oder rechtzeitig) aufzeichnen und diese Aufzeichnungen mindestens zwei Jahre beginnend ab dem für die Aufzeichnung maßgeblichen Zeitpunkt aufbewahren. Der Auftragnehmer versichert, dass er in der Vergangenheit nicht wegen Verstößen gegen diese oder andere gesetzliche Verpflichtungen (soweit auf ihn bereits anwendbar) im Bereich von Lohnzahlungen behördlich oder gerichtlich sanktioniert wurde, insbesondere in diesem Zusammenhang nicht von öffentlichen Aufträgen ausgeschlossen worden ist. Der Auftragnehmer wird es dem Auftraggeber sofort anzeigen, falls solche Verstöße bzw. Ausschlüsse während der Vertragslaufzeit auftreten sollen. Ferner schließt der Auftragnehmer gleichlautende oder zumindest sinngemäße Vereinbarungen mit seinen Nachunternehmern (Unterfrachtführern) ab und zahlt diesen Vergütungen, die eine Zahlung des Mindestlohnes an ihre Arbeitnehmer ermöglichen.

Der Auftragnehmer erklärt, dass der Auftraggeber bei jeglicher Zuwiderhandlung schadlos gehalten wird. Das heißt, dass der Auftraggeber im Innenverhältnis für jeden Fall eines möglichen Gesetzesverstoßes von Ersatzansprüchen Dritter rechtsverbindlich freigestellt wird.
`);

const PAGE_2_VEREINBARUNG = nl2p(`
In verschiedensten EU-Staaten gelten zwingende Vorschriften zur Einhaltung der Meldepflichten sowie zur Bezahlung des Mindestlohns. Teilweise sehen gesetzliche Bestimmungen bei einer Unterentlohnung eine verschuldensunabhängige Unternehmerhaftung sowie strafrechtliche Sanktionen vor. Der Auftragnehmer ist verpflichtet, seine Mitarbeiter und sonstigen Erfüllungsgehilfen, insbesondere Subunternehmer, nachweislich (schriftlich) von der Verpflichtung zur Einhaltung der jeweiligen Mindestlohn-Bestimmungen zu unterrichten und sich mit der Sorgfalt eines ordentlichen Unternehmers davon zu überzeugen, dass diese auch tatsächlich befolgt werden. Auf Verlagen hat der Auftragnehmer dem Auftraggeber entsprechende Nachweise zur Einhaltung dieser gesetzlichen Bestimmungen unverzüglich und kostenfrei vorzulegen. Der Auftragnehmer verpflichtet sich, den Auftraggeber hinsichtlich aller Aufwendungen, Kosten, Ansprüche und Forderungen (unabhängig vom Rechtsgrund und verschuldensunabhängig), die im Zusammenhang mit der Verletzung dieser Vereinbarung oder Nichteinhaltung von Mindestlohn-Bestimmungen (inklusive den dazu erlassenen Verordnungen) entstehen, vollumfänglich, d. h. auch der Höhe nach unbeschränkt, schad- und klaglos zu halten. Das gilt insbesondere auch für das Entstehen von Verwaltungskosten, etc. Der Auftragnehmer haftet für alle seine Subunternehmer.
`);

// Fixed legal terms — page 3. Verbatim from the paper template.
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
  <p class="bold-block">KUNDENSCHUTZ GILT ALS VEREINBART! Beim Eintritt in den Wettbewerb, verfallen Ihre Frachtrechte und es wird eine Haftbarmachung in Höhe von Euro 10.000,-- verrechnet!</p>
  <p class="center bold">Wir arbeiten ausschließlich nach den CMR-Bedingungen neuester Fassung.</p>
`;

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
    <div class="dateRow">Stadlhof, ${today}<br/>Nr. ${escapeHtml(order.orderNr)}</div>

    <h1 class="title">TRANSPORTAUFTRAG</h1>

    <div class="field-row"><span class="field-label">An Firma:</span> ${escapeHtml(order.recipientCompany)}</div>
    <div class="field-row"><span class="field-label">z.H.:</span> ${escapeHtml(order.recipientContact)}</div>
    <p>Wie bereits telefonisch mit Ihnen vereinbart, übernehmen Sie in unserem Auftrag folgenden Transport:</p>

    <table class="fields">
      <tr><td class="label">Ladetermin:</td><td>${escapeHtml(loadingUntil)}</td></tr>
      <tr><td class="label">Ladestelle:</td><td>${escapeHtml(order.loadingCompany)}<br/>${escapeHtml(order.loadingAddress)}</td></tr>
      <tr><td class="label">Ladenummer:</td><td>${escapeHtml(order.loadingNumber)}</td></tr>
      <tr><td class="label">Ladegut:</td><td>${escapeHtml(order.cargoDescription)}${order.loadingMeters ? `<br/>${escapeHtml(order.loadingMeters)}` : ''}</td></tr>
      <tr><td class="label">Entladetermin:</td><td>${escapeHtml(unloadingUntil)}</td></tr>
      <tr><td class="label">Entladestelle:</td><td>${escapeHtml(order.unloadingCompany)}<br/>${escapeHtml(order.unloadingAddress)}</td></tr>
    </table>

    <table class="fields">
      <tr><td class="label">Frachtsatz:</td><td>€ ${escapeHtml(order.freightRate)} pauschal (inkl. allen Mauten, Nebenspesen u. Unterwegskosten).</td></tr>
      <tr><td class="label">Terminzuschlag:</td><td>€ ${escapeHtml(order.deadlineSurcharge)} pauschal</td></tr>
    </table>

    <div class="field-row"><span class="field-label">Transportmittel:</span> ${escapeHtml(order.vehicleType)}</div>
    <div class="field-row"><span class="field-label">Sonstiges:</span> ${escapeHtml(order.notes)}</div>

    ${footer('Seite | 1')}
  </div>

  <div class="page">
    ${letterhead}
    ${PAGE_2_TERMS}
    ${PAGE_2_VERSICHERUNG}
    ${PAGE_2_REST}
    <h2 class="section">Erklärung</h2>
    ${PAGE_2_ERKLAERUNG}
    <h2 class="section">Vereinbarung</h2>
    ${PAGE_2_VEREINBARUNG}
    ${footer('Seite | 2')}
  </div>

  <div class="page">
    ${letterhead}
    ${PAGE_3_TOP}
    ${PAGE_3_AUSLAENDERBESCHAEFTIGUNG}
    ${PAGE_3_REST}
    ${PAGE_3_KUNDENSCHUTZ}

    <div class="signBlock">
      <p>In Erwartung einer zuverlässigen, ordnungsgemäßen und termingerechten Transportdurchführung verbleiben wir mit freundlichen Grüßen</p>
      <p class="center signName">Sascha Hochreiter<br/><span style="font-size:9px">(Gültig ohne Unterschrift - erstellt durch Fax-Computer)</span></p>
      <p>Bitte Transportauftrag bestätigen und innerhalb einer Stunde zurückschicken:</p>
    </div>

    <table class="signoff">
      <tr><td class="k" rowspan="2">Zahlungsziel:</td><td>45 Tage netto nach Rechnungserhalt</td></tr>
      <tr><td>14 Tage abzüglich 3 % Skonto</td></tr>
      <tr><td class="k">Kennzeichen:</td><td>${escapeHtml(order.licensePlate || '')}</td></tr>
      <tr><td class="k">Fahrer:</td><td>${escapeHtml(order.driverName || '')}</td></tr>
      <tr><td class="k">Unterschrift:</td><td></td></tr>
    </table>

    ${footer('Seite | 3')}
  </div>

</body>
</html>`;
}