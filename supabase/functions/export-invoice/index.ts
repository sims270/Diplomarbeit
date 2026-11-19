// Supabase Edge Function: export-invoice
//
// Alles rund um die Rechnung zu erledigten Aufträgen — als Einzelrechnung
// (eine Ladung) oder als Sammelrechnung (mehrere Ladungen, meist für große
// Kunden, die nicht jede Fahrt einzeln verrechnet haben wollen):
//
//   action "load"        — { orderId }: die Rechnung, auf der der Auftrag
//                          steht, samt allen Positionen. Gibt es keine,
//                          kommt invoice: null zurück — angelegt wird hier
//                          nichts, denn erst der Chef entscheidet, ob Einzel-
//                          oder Sammelrechnung.
//   action "create"      — { orderIds }: legt die Rechnung über diese
//                          Aufträge an, vergibt die Belegnummer und füllt
//                          Kopf und Positionen aus den Aufträgen vor.
//   action "addItems"    — { invoiceId, orderIds }: weitere Ladungen auf
//                          eine bestehende Rechnung.
//   action "removeItem"  — { invoiceId, itemId }: eine Ladung wieder von der
//                          Rechnung nehmen (nie die letzte).
//   action "export"      — { invoiceId }: baut daraus die .xlsx-Datei.
//
// Alle Wege, die Positionen erzeugen, gehen durch dieselbe Vorbefüllung
// (prefillInvoice), damit es nur eine Stelle gibt, die weiß, wie aus einem
// Auftrag eine Rechnungsposition wird. Gedruckt wird ausschließlich, was in
// invoices und invoice_items steht. Ändert der Chef die Rechnung, bleibt
// der Auftrag unangetastet: er dokumentiert die Fahrt, die Rechnung das
// Geschäft.
//
// Bewusst nur "der Rest" der Rechnung: Briefkopf oben und das Foto der
// LKW-Flotte unten sind auf dem Rechnungspapier vorgedruckt. Die Datei
// füllt also nur den freien Bereich dazwischen — freigehalten wird er über
// die Druckränder (siehe PAGE_SETUP), nicht über leere Zeilen. Reicht bei
// einer Sammelrechnung eine Seite nicht, wird zwischen zwei Positionen
// umgebrochen: unten "Übertrag: € …", die Folgeseite beginnt wieder mit
// Empfänger, Rechnungsblock samt Seitenzahl, Tabellenkopf und demselben
// Übertrag — wie auf den bisherigen Sammelrechnungen der Firma.
//
// Warum Edge Function und nicht im Client: exceljs ist keine Abhängigkeit
// der App (siehe package.json), und alle privilegierten Serveraufgaben
// dieses Projekts laufen bereits als Edge Function mit verifyBoss — so wie
// export-tank-entries, an dem sich diese Function auch sonst orientiert.
//
// "Auftrag" heißt hier eigener Auftrag (orders) oder Fremdauftrag
// (external_orders): Auch beim Fremdauftrag wird die Firma verrechnet, von
// der er kommt — nur der fremde Frachtführer bekommt keine Rechnung, den
// bezahlt die Firma. Beide Arten dürfen auf derselben Rechnung stehen.
//
// Tabellen: supabase/migrations/20260914130000_add_collective_invoices.sql
// und 20261005140000_invoice_external_orders.sql
//
// Deploy: supabase functions deploy export-invoice

import ExcelJS from "npm:exceljs@4.4.0";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { INTERNAL_ERROR_MESSAGE, internalError } from "../_shared/errors.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

interface OrderRow {
  id: string;
  order_nr: string;
  status: string;
  loading_date: string | null;
  loading_company: string;
  loading_address: string;
  loading_meters: string;
  /** Ladegut (orders seit 20261119200000, external_orders schon immer). */
  cargo_description: string;
  unloading_date: string | null;
  unloading_company: string;
  unloading_address: string;
  /** Auftraggeber, der die Rechnung bekommt; '' = die Ladestelle. */
  client_company: string;
  /** Seine Anschrift aus der Firmenliste; '' = über den Namen nachschlagen. */
  client_address: string;
  /** true = Fremdauftrag (external_orders), sonst eigener Auftrag (orders). */
  external: boolean;
}

/** Die Spalten gibt es in orders und external_orders gleichermaßen. */
const ORDER_COLUMNS =
  "id, order_nr, status, loading_date, loading_company, loading_address, loading_meters, " +
  "cargo_description, unloading_date, unloading_company, unloading_address, client_company, client_address";

/**
 * Der Rechnungskopf, wie er in public.invoices steht — jedes Feld
 * bearbeitbar im Formular des Chef-Dashboards.
 */
interface InvoiceRow {
  id: string;
  belegnummer: string | null;
  rechnungsdatum: string | null;
  empfaenger_name: string | null;
  empfaenger_strasse: string | null;
  empfaenger_ort: string | null;
  kundennummer: string | null;
  uid_nummer: string | null;
  ust_satz: string | number | null;
  zahlungsziel: string | null;
  /** null = aus Preisen und Ust-Satz berechnen (computeTotals). */
  netto_betrag: string | number | null;
  ust_betrag: string | number | null;
  end_betrag: string | number | null;
}

const INVOICE_COLUMNS =
  "id, belegnummer, rechnungsdatum, empfaenger_name, empfaenger_strasse, " +
  "empfaenger_ort, kundennummer, uid_nummer, ust_satz, zahlungsziel, " +
  "netto_betrag, ust_betrag, end_betrag";

/**
 * Eine Position = ein verrechneter Auftrag.
 *
 * numeric-Spalten liefert PostgREST als String, damit keine
 * Nachkommastellen verloren gehen; für die Excel-Zelle werden sie in echte
 * Zahlen umgewandelt (toNumber).
 */
interface ItemRow {
  id: string;
  /**
   * Der Auftrag hinter der Position — eigener oder Fremdauftrag. In der
   * Tabelle sind das zwei Spalten (order_id, external_order_id);
   * loadInvoiceById legt sie hier zu einer zusammen, denn die ids beider
   * Tabellen sind uuids und können nicht kollidieren.
   */
  order_id: string;
  /** true = Fremdauftrag. */
  external: boolean;
  reihenfolge: number;
  position_datum: string | null;
  bezeichnung: string | null;
  transportnr: string | null;
  ladestelle: string | null;
  ladedatum: string | null;
  entladestelle: string | null;
  entladedatum: string | null;
  preis: string | number | null;
  /** Freie Zeile über "pauschal" (20261119210000_invoice_item_extras.sql). */
  zusatztext: string | null;
  /** Dieselzuschlag in Prozent vom Preis; null = keiner. */
  diesel_prozent: string | number | null;
  /** Nur zur Anzeige im Formular — welcher Auftrag hinter der Position steht. */
  order_nr?: string;
}

const ITEM_COLUMNS =
  "id, order_id, external_order_id, reihenfolge, position_datum, bezeichnung, transportnr, " +
  "ladestelle, ladedatum, entladestelle, entladedatum, preis, zusatztext, diesel_prozent, " +
  "orders(order_nr), " +
  "external_orders(order_nr)";

interface InvoiceWithItems {
  invoice: InvoiceRow;
  items: ItemRow[];
}

/**
 * Seitenmaße, abgenommen an einer echten Rechnung auf dem Firmenpapier
 * (Briefkopf oben und das Foto der Halle unten sind vorgedruckt):
 *
 *   * Der Empfängername steht 45 mm unter der Blattkante — so hoch wie
 *     "Gülde GmbH & Co KG" auf der Musterrechnung. Daraus der obere Rand.
 *   * Das Hallenfoto beginnt bei rund 225 mm. Gedruckt wird höchstens bis
 *     221 mm (unterer Rand), der letzte Text endet also sicher darüber.
 *   * Links 19 mm, bündig mit dem Briefkopf.
 *
 * Alles in Zoll, wie Excel es erwartet.
 */
const MM = 1 / 25.4;
const PAGE_SETUP = {
  paperSize: 9, // A4
  orientation: "portrait" as const,
  margins: {
    top: 40.8 * MM,
    bottom: 76.2 * MM,
    left: 18 * MM,
    right: 10 * MM,
    header: 0,
    footer: 0,
  },
};

/**
 * Feste Zeilenhöhen in Punkt, damit sich ausrechnen lässt, was auf eine
 * Seite passt, und jede Zeile dort landet, wo sie auf der Musterrechnung
 * steht. Kopf: Name bei 45 mm, Anschrift und Rechnungsblock im Abstand von
 * 4,8 mm, Tabellenkopf bei 80 mm, erste Position bei 86 mm.
 */
const HEAD_PT = { title: 16, gap: 13.6, line: 13.6, tableHead: 15.6, afterTableHead: 4.5 };
/** Zeilen der Positionen und Summen — 4,2 mm wie auf der Musterrechnung. */
const LINE_PT = 12;
/** Abstand zwischen zwei Positionen und vor den Summen. */
const GAP_PT = 6;
/** Platz zwischen oberem und unterem Rand (180 mm = 510 pt) mit etwas Luft,
 *  damit Excel nie von sich aus früher umbricht. */
const PAGE_PT = 500;
/** Zeile "Übertrag:" samt Abstand davor — muss unten auf jede volle Seite passen. */
const CARRY_PT = GAP_PT + LINE_PT;

/** Vorgabe für neue Rechnungen; im Formular änderbar. */
const MWST_SATZ = 20;
const ZAHLUNGSZIEL = "45 Tage netto ohne Abzug";

/**
 * ExcelJS rechnet ein JS-Date über UTC in die Excel-Serienzahl um. Ein aus
 * 'YYYY-MM-DD' gebautes Date liegt auf UTC-Mitternacht und kippt dabei je
 * nach Zeitzone auf den Vortag. Mittags verankert übersteht das Datum jede
 * Verschiebung, ohne dass die Zelle ihren echten Datumstyp verliert.
 * (Gleiche Begründung wie in export-tank-entries.)
 */
function toExcelDate(isoDate: string | null): Date | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/**
 * Das heutige Datum in Österreich als 'YYYY-MM-DD'.
 *
 * Die Edge Function läuft auf einem Server in UTC — ein schlichtes
 * toISOString() würde die Rechnung an einem Sommerabend nach 22 Uhr auf den
 * Vortag datieren. Die Zeitzone hier explizit zu nennen, ist der einzige
 * Weg, der auch über die Sommerzeitumstellung hinweg stimmt.
 */
function heuteInOesterreich(): string {
  // 'en-CA' liefert genau das ISO-Format 'YYYY-MM-DD'.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "07.01.2026" — für Datumsangaben, die im Fließtext einer Zelle stehen. */
function toGermanDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

/** numeric kommt aus PostgREST als String; leer bleibt leer, nicht 0. */
function toNumber(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const roundCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Nettobetrag, Ust und Endbetrag: was der Chef eingetragen hat, sonst
 * ausgerechnet. Ein eingetragener Betrag rechnet nach unten weiter.
 * Dieselbe Rechnung wie lib/invoiceTotals.ts im Formular — bei einer
 * Änderung beide anpassen.
 */
function computeTotals({ invoice, items }: InvoiceWithItems) {
  // Je Position Preis plus Dieselzuschlag (positionTotal).
  const prices = items
    .map((item) => positionTotal(item))
    .filter((price): price is number => price !== null);
  const ustSatz = toNumber(invoice.ust_satz);

  const netto = toNumber(invoice.netto_betrag) ??
    (prices.length > 0 ? roundCents(prices.reduce((a, b) => a + b, 0)) : null);
  const ust = toNumber(invoice.ust_betrag) ??
    (netto !== null && ustSatz !== null ? roundCents((netto * ustSatz) / 100) : null);
  const end = toNumber(invoice.end_betrag) ??
    (netto !== null ? roundCents(netto + (ust ?? 0)) : null);

  return { netto, ust, end };
}

/**
 * Die Adressen stehen als "Straße, A-PLZ Ort" in der Datenbank (siehe
 * formatAddress in app/services/siteCompanyService.ts). Für den
 * Empfängerblock braucht es beide Teile untereinander, für die Zeilen
 * "lt. Weisung in ..." dagegen nur den Ort — genau so steht es auf der
 * bisherigen Rechnung ("lt. Weisung in A-8770 Musterdorf").
 *
 * Ohne Beistrich ist nicht zu erraten, wo die Straße aufhört; dann gilt der
 * ganze Text als Ortsangabe, statt ihn an einer geratenen Stelle zu
 * zerschneiden.
 */
function splitAddress(address: string): { street: string; town: string } {
  const trimmed = address.trim();
  const separator = trimmed.lastIndexOf(",");

  if (separator === -1) return { street: "", town: trimmed };

  return {
    street: trimmed.slice(0, separator).trim(),
    town: trimmed.slice(separator + 1).trim(),
  };
}

/**
 * Länderkürzel aus einer Ortsangabe: "A-8770 Musterdorf" → "A",
 * "D-58762 Altena" → "D".
 *
 * Auf der Rechnung steht es vor der Kundennummer ("D 000123"); gespeichert
 * ist in site_companies.bmd_kto_nr nur die nackte Kontonummer aus BMD. Ohne
 * Kürzel in der Anschrift bleibt es weg, statt "A" zu unterstellen — eine
 * falsche Länderkennung auf einer Rechnung wäre schlimmer als gar keine.
 */
function countryCode(town: string): string {
  const match = town.trim().match(/^([A-Za-z]{1,3})-/);
  return match ? match[1].toUpperCase() : "";
}

/**
 * "D 000123" — Länderkürzel der Anschrift plus BMD-Kontonummer. Ist die
 * Spalte numerisch, liefert PostgREST eine Zahl; String() fängt beide
 * Fälle ab.
 */
function buildKundennummer(bmdKtoNr: unknown, town: string): string {
  const nummer = bmdKtoNr === null || bmdKtoNr === undefined ? "" : String(bmdKtoNr).trim();
  if (!nummer) return "";

  const code = countryCode(town);
  return code ? `${code} ${nummer}` : nummer;
}

/**
 * Die Bezeichnung der Position. Am liebsten das Ladegut aus dem Auftrag —
 * auf den Rechnungen der Firma steht genau das ("12 Stk. Europaletten
 * Kaltband, 24.400 kg"). Fehlt es, wie bisher "1 Ladung" bzw. "1 Ladung,
 * 13,6 Lademeter". Der Chef kann die Bezeichnung im Formular überschreiben.
 */
function buildDescription(cargoDescription: string | null, loadingMeters: string): string {
  const cargo = (cargoDescription ?? "").trim();
  if (cargo) return cargo;
  const meters = loadingMeters.trim();
  return meters ? `1 Ladung, ${meters} Lademeter` : "1 Ladung";
}

interface CustomerRow {
  bmd_kto_nr: string | number | null;
  uid_nummer: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
}

/**
 * "Straße, A-PLZ Ort" aus site_companies — dieselbe Schreibweise wie
 * formatCompanyAddress in app/services/companyAddress.ts, damit
 * splitAddress sie wieder in Straße und Ort zerlegen kann.
 */
function customerAddress(customer: CustomerRow | null): string {
  if (!customer) return "";
  const plz = customer.plz?.trim();
  const postcode = plz && !/^[A-Za-z]{1,3}-/.test(plz) ? `A-${plz}` : plz;
  const town = [postcode, customer.ort?.trim()].filter(Boolean).join(" ");
  return [customer.strasse?.trim(), town].filter(Boolean).join(", ");
}

/**
 * Kundenstammdaten des Rechnungsempfängers (Auftraggeber, sonst
 * Ladestelle) aus site_companies — bmd_kto_nr ist die
 * Kundennummer, uid_nummer die UID.
 *
 * Verbunden wird über den Firmennamen, denn im Auftrag steht nur er als
 * Text. Zuerst exakt, dann ohne Rücksicht auf Groß-/Kleinschreibung: Der
 * Name kann aus dem Dropdown stammen (dann passt er genau) oder von Hand
 * getippt sein (dann vielleicht "voestalpin" statt "Voestalpin").
 *
 * Findet sich nichts, ist das kein Fehler, sondern ein leeres Feld auf der
 * Rechnung — aber einer, der im Function-Log stehen soll, sonst rätselt der
 * Chef, warum die zwei Zeilen leer bleiben. Nachtragen kann er sie im
 * Formular ohnehin.
 */
async function loadCustomer(
  adminClient: SupabaseClient,
  companyName: string,
): Promise<CustomerRow | null> {
  const name = companyName.trim();
  if (!name) return null;

  const columns = "bmd_kto_nr, uid_nummer, strasse, plz, ort";

  // limit(1) statt maybeSingle(): Eine Firma mit mehreren Werken steht
  // mehrfach in site_companies, und maybeSingle() scheiterte dann an "mehr
  // als eine Zeile" — Kundennummer und UID blieben leer.
  const exact = await adminClient
    .from("site_companies")
    .select(columns)
    .eq("name", name)
    .limit(1);

  if (exact.error) {
    console.warn("[export-invoice] Kundendaten nicht lesbar:", exact.error.message);
    return null;
  }
  if (exact.data?.[0]) return exact.data[0] as unknown as CustomerRow;

  // % und _ sind in ilike Platzhalter — in einem Firmennamen sind sie als
  // Zeichen gemeint und werden deshalb maskiert.
  const pattern = name.replace(/([\\%_])/g, "\\$1");

  const loose = await adminClient
    .from("site_companies")
    .select(columns)
    .ilike("name", pattern)
    .limit(1);

  if (loose.error) {
    console.warn("[export-invoice] Kundendaten nicht lesbar:", loose.error.message);
    return null;
  }

  const found = loose.data?.[0] as CustomerRow | undefined;

  if (!found) {
    console.warn(
      `[export-invoice] Firma "${name}" steht nicht in site_companies — ` +
        "Kundennummer und UID-Nr. bleiben auf der Rechnung leer.",
    );
    return null;
  }

  return found;
}

/** Eigener Fehlertyp, damit der HTTP-Status bis zur Antwort durchkommt. */
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Die Aufträge zu den ids, aus beiden Tabellen: eigene Aufträge (orders)
 * und Fremdaufträge (external_orders). Beim Fremdauftrag fährt ein fremder
 * Frachtführer — verrechnet wird trotzdem die Firma, von der der Auftrag
 * kommt, genau wie beim eigenen. Die ids sind uuids, eine id steht also
 * höchstens in einer der beiden Tabellen.
 */
async function fetchOrders(adminClient: SupabaseClient, orderIds: string[]): Promise<OrderRow[]> {
  if (orderIds.length === 0) return [];

  const [own, external] = await Promise.all([
    adminClient.from("orders").select(ORDER_COLUMNS).in("id", orderIds),
    adminClient.from("external_orders").select(ORDER_COLUMNS).in("id", orderIds),
  ]);

  if (own.error) throw dbFailure(own.error);
  if (external.error) throw dbFailure(external.error);

  return [
    ...((own.data ?? []) as unknown as Omit<OrderRow, "external">[]).map((o) => ({ ...o, external: false })),
    ...((external.data ?? []) as unknown as Omit<OrderRow, "external">[]).map((o) => ({ ...o, external: true })),
  ];
}

/**
 * Die Aufträge zu den ids — geprüft, dass es sie gibt und dass sie erledigt
 * sind. Sortiert nach Ladedatum, damit eine Sammelrechnung die Fahrten in
 * der Reihenfolge aufführt, in der sie stattgefunden haben.
 */
async function loadCompletedOrders(
  adminClient: SupabaseClient,
  orderIds: string[],
): Promise<OrderRow[]> {
  const orders = await fetchOrders(adminClient, orderIds);
  if (orders.length !== orderIds.length) {
    throw new HttpError("Mindestens ein Auftrag wurde nicht gefunden.", 404);
  }

  // Abgerechnet wird, was gefahren wurde. Die Oberfläche bietet ohnehin nur
  // erledigte Aufträge an — die Regel gehört trotzdem hierher, damit sie
  // nicht allein an der Oberfläche hängt.
  const open = orders.find((order) => order.status !== "completed");
  if (open) {
    throw new HttpError(
      `Auftrag Nr. ${open.order_nr} ist noch nicht erledigt — verrechnet wird erst, was gefahren wurde.`,
      409,
    );
  }

  return orders.sort((a, b) =>
    (a.loading_date ?? a.unloading_date ?? "").localeCompare(
      b.loading_date ?? b.unloading_date ?? "",
    )
  );
}

/**
 * Position aus dem Auftrag vorbefüllt. Der Preis kommt aus order_prices bzw.
 * external_orders.customer_price; ohne Eintrag bleibt er leer.
 */
function itemPrefill(order: OrderRow, preis: string | number | null) {
  const loading = splitAddress(order.loading_address);
  const unloading = splitAddress(order.unloading_address);

  return {
    position_datum: order.loading_date,
    bezeichnung: buildDescription(order.cargo_description, order.loading_meters),
    transportnr: order.order_nr,
    ladestelle: loading.town ? `lt. Weisung in ${loading.town}` : "",
    ladedatum: order.loading_date,
    entladestelle: unloading.town ? `lt. Weisung in ${unloading.town}` : "",
    entladedatum: order.unloading_date,
    preis,
  };
}

/**
 * Füllt, was noch nie befüllt wurde: den Kopf (erkennbar an
 * empfaenger_name = null) aus dem Auftrag der ersten Position, jede
 * Position (bezeichnung = null) aus ihrem Auftrag. Was der Chef im
 * Formular geändert hat, überschreibt hier nichts — das Formular speichert
 * immer Strings, nie null.
 */
async function prefillInvoice(adminClient: SupabaseClient, invoiceId: string): Promise<void> {
  const { invoice, items } = await loadInvoiceById(adminClient, invoiceId);

  const emptyItems = items.filter((item) => item.bezeichnung === null);
  const needsHeader = invoice.empfaenger_name === null;
  if (!needsHeader && emptyItems.length === 0) return;

  const orderIds = [
    ...new Set([...emptyItems.map((item) => item.order_id), ...(needsHeader ? [items[0]?.order_id] : [])]),
  ].filter((id): id is string => Boolean(id));

  const orders = new Map(
    (await fetchOrders(adminClient, orderIds)).map((order) => [order.id, order]),
  );

  const emptyItemIds = emptyItems.map((item) => item.order_id);
  const [ownPrices, externalPrices] = await Promise.all([
    adminClient.from("order_prices").select("order_id, preis").in("order_id", emptyItemIds),
    adminClient.from("external_orders").select("id, customer_price").in("id", emptyItemIds),
  ]);
  if (ownPrices.error) throw dbFailure(ownPrices.error);
  if (externalPrices.error) throw dbFailure(externalPrices.error);
  const prices = new Map<string, string | number | null>([
    ...((ownPrices.data ?? []) as { order_id: string; preis: string | number | null }[])
      .map((row): [string, string | number | null] => [row.order_id, row.preis]),
    ...((externalPrices.data ?? []) as { id: string; customer_price: string | number | null }[])
      .map((row): [string, string | number | null] => [row.id, row.customer_price]),
  ]);

  for (const item of emptyItems) {
    const order = orders.get(item.order_id);
    if (!order) continue;
    const { error: itemError } = await adminClient
      .from("invoice_items")
      .update(itemPrefill(order, prices.get(item.order_id) ?? null))
      .eq("id", item.id);
    if (itemError) throw dbFailure(itemError);
  }

  const firstOrder = items[0] ? orders.get(items[0].order_id) : undefined;
  if (needsHeader && firstOrder) {
    // Die Rechnung bekommt der Auftraggeber — ist keiner eingetragen, wie
    // bisher die Ladestelle. Seine Anschrift kommt aus dem Auftrag (aus der
    // Firmenliste gewählt) oder, wenn er nur getippt wurde, über den Namen
    // aus site_companies.
    const client = (firstOrder.client_company ?? "").trim();
    const billTo = client || firstOrder.loading_company;
    const customer = await loadCustomer(adminClient, billTo);
    const recipient = splitAddress(
      client
        ? (firstOrder.client_address ?? "").trim() || customerAddress(customer)
        : firstOrder.loading_address,
    );

    const { error: headerError } = await adminClient
      .from("invoices")
      .update({
        rechnungsdatum: invoice.rechnungsdatum ?? heuteInOesterreich(),
        empfaenger_name: billTo,
        empfaenger_strasse: recipient.street,
        empfaenger_ort: recipient.town,
        kundennummer: buildKundennummer(customer?.bmd_kto_nr, recipient.town),
        uid_nummer: customer?.uid_nummer ?? "",
        ust_satz: invoice.ust_satz ?? MWST_SATZ,
        zahlungsziel: invoice.zahlungsziel ?? ZAHLUNGSZIEL,
      })
      .eq("id", invoiceId);
    if (headerError) throw dbFailure(headerError);
  }
}

async function loadInvoiceById(
  adminClient: SupabaseClient,
  invoiceId: string,
): Promise<InvoiceWithItems> {
  const [invoiceResult, itemsResult] = await Promise.all([
    adminClient.from("invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).maybeSingle(),
    adminClient
      .from("invoice_items")
      .select(ITEM_COLUMNS)
      .eq("invoice_id", invoiceId)
      .order("reihenfolge", { ascending: true }),
  ]);

  if (invoiceResult.error) throw dbFailure(invoiceResult.error);
  if (itemsResult.error) throw dbFailure(itemsResult.error);
  if (!invoiceResult.data) throw new HttpError("Rechnung nicht gefunden.", 404);

  // Die eingebettete Auftragsnummer flach machen — der Client soll nicht
  // wissen müssen, wie PostgREST Beziehungen verschachtelt. Dazu eigener
  // und Fremdauftrag in eine order_id zusammengelegt (siehe ItemRow).
  type RawItem = Omit<ItemRow, "order_id" | "external" | "order_nr"> & {
    order_id: string | null;
    external_order_id: string | null;
    orders?: { order_nr?: string } | null;
    external_orders?: { order_nr?: string } | null;
  };
  const items: ItemRow[] = ((itemsResult.data ?? []) as unknown as RawItem[]).map(
    ({ orders, external_orders, order_id, external_order_id, ...item }) => ({
      ...item,
      order_id: (order_id ?? external_order_id) as string,
      external: order_id === null,
      order_nr: orders?.order_nr ?? external_orders?.order_nr ?? "",
    }),
  );

  return { invoice: invoiceResult.data as unknown as InvoiceRow, items };
}

/** Prüft die ids aus dem Request-Body: nicht leer, keine Doppelten. */
function parseOrderIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new HttpError("orderIds fehlt.", 400);
  const ids = [...new Set(value.filter((id): id is string => typeof id === "string" && id !== ""))];
  if (ids.length === 0) throw new HttpError("Keine Aufträge ausgewählt.", 400);
  return ids;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Einzelne Zeile oder unique-Verletzung — beides heißt: schon verrechnet. */
function alreadyBilled(message: string): boolean {
  return message.includes("bereits auf einer Rechnung") || message.includes("duplicate key");
}

async function handleLoad(adminClient: SupabaseClient, orderId: string) {
  // orderId kann ein eigener oder ein Fremdauftrag sein. Er landet als
  // Text im or()-Filter — deshalb vorher sicherstellen, dass er wirklich nur
  // eine uuid ist und keine Filtersyntax (Beistrich, Klammern) mitbringt.
  if (!UUID_PATTERN.test(orderId)) throw new HttpError("Ungültige Auftrags-id.", 400);

  const { data, error } = await adminClient
    .from("invoice_items")
    .select("invoice_id")
    .or(`order_id.eq.${orderId},external_order_id.eq.${orderId}`)
    .maybeSingle();

  if (error) throw dbFailure(error);
  if (!data) return { invoice: null, items: [] };

  const invoiceId = (data as { invoice_id: string }).invoice_id;
  // Rechnungen, die vor dieser Fassung angelegt wurden, können noch
  // unbefüllte Felder haben — beim Öffnen nachholen.
  await prefillInvoice(adminClient, invoiceId);
  return await loadInvoiceById(adminClient, invoiceId);
}

// Datenbankfehler nur ins Log, der Client bekommt eine allgemeine Meldung.
function dbFailure(cause: unknown): HttpError {
  console.error("[export-invoice]", cause);
  return new HttpError(INTERNAL_ERROR_MESSAGE, 500);
}

async function handleCreate(adminClient: SupabaseClient, orderIds: string[]) {
  const orders = await loadCompletedOrders(adminClient, orderIds);

  // Belegnummer und Positionen in einer Transaktion (siehe create_invoice):
  // scheitert eine Position, ist auch die Nummer nicht verbraucht.
  const rechnungsdatum = heuteInOesterreich();
  const { data: invoiceId, error } = await adminClient.rpc("create_invoice", {
    p_order_ids: orders.map((order) => order.id),
    p_jahr: Number(rechnungsdatum.slice(0, 4)),
  });

  if (error) {
    throw new HttpError(
      alreadyBilled(error.message)
        ? "Mindestens einer der Aufträge steht bereits auf einer Rechnung."
        : dbFailure(error).message,
      409,
    );
  }

  await prefillInvoice(adminClient, invoiceId as string);
  return await loadInvoiceById(adminClient, invoiceId as string);
}

async function handleAddItems(
  adminClient: SupabaseClient,
  invoiceId: string,
  orderIds: string[],
) {
  const { items } = await loadInvoiceById(adminClient, invoiceId);
  const orders = await loadCompletedOrders(adminClient, orderIds);

  const start = items.reduce((max, item) => Math.max(max, item.reihenfolge), 0);
  const { error } = await adminClient.from("invoice_items").insert(
    orders.map((order, index) => ({
      invoice_id: invoiceId,
      // Genau eine der beiden Spalten (CHECK in 20261005140000).
      order_id: order.external ? null : order.id,
      external_order_id: order.external ? order.id : null,
      reihenfolge: start + index + 1,
      ...itemPrefill(order),
    })),
  );

  if (error) {
    throw new HttpError(
      alreadyBilled(error.message)
        ? "Mindestens einer der Aufträge steht bereits auf einer Rechnung."
        : dbFailure(error).message,
      409,
    );
  }

  return await loadInvoiceById(adminClient, invoiceId);
}

async function handleRemoveItem(
  adminClient: SupabaseClient,
  invoiceId: string,
  itemId: string,
) {
  const { items } = await loadInvoiceById(adminClient, invoiceId);

  if (!items.some((item) => item.id === itemId)) {
    throw new HttpError("Position nicht gefunden.", 404);
  }
  // Eine Rechnung ohne Position hätte trotzdem eine Belegnummer verbraucht —
  // und würde leer gedruckt. Die letzte Ladung bleibt deshalb stehen.
  if (items.length <= 1) {
    throw new HttpError("Die letzte Ladung einer Rechnung kann nicht entfernt werden.", 409);
  }

  const { error } = await adminClient.from("invoice_items").delete().eq("id", itemId);
  if (error) throw dbFailure(error);

  return await loadInvoiceById(adminClient, invoiceId);
}

/**
 * Dieselzuschlag einer Position in Euro: Preis mal Prozentsatz, auf Cent
 * gerundet. null, wenn es keinen Zuschlag (oder keinen Preis) gibt. Gleiche
 * Rechnung wie dieselAmount in lib/invoiceTotals.ts.
 */
function dieselAmount(item: ItemRow): number | null {
  const preis = toNumber(item.preis);
  const prozent = toNumber(item.diesel_prozent);
  if (preis === null || prozent === null || prozent === 0) return null;
  return roundCents((preis * prozent) / 100);
}

/** Was eine Position kostet: Preis plus Dieselzuschlag; null ohne Preis. */
function positionTotal(item: ItemRow): number | null {
  const preis = toNumber(item.preis);
  if (preis === null) return null;
  return roundCents(preis + (dieselAmount(item) ?? 0));
}

/** "7 %" bzw. "7,5 %" — so steht der Satz in der Zeile "Dieselzuschlag". */
function formatPercent(value: number): string {
  return `${String(value).replace(".", ",")} %`;
}

/**
 * Länder zu den Kürzeln vor der Postleitzahl ("D-59174 Kamen"). Auf der
 * Rechnung steht bei Auslandskunden der Ort ohne Kürzel und darunter das
 * Land — wie auf der Musterrechnung "59174 Kamen / Deutschland". Österreich
 * bekommt keine Landzeile. Ein unbekanntes Kürzel bleibt, wie es ist, statt
 * ein Land zu raten.
 */
const COUNTRY_NAMES: Record<string, string> = {
  D: "Deutschland",
  DE: "Deutschland",
  I: "Italien",
  IT: "Italien",
  CH: "Schweiz",
  FL: "Liechtenstein",
  LI: "Liechtenstein",
  SLO: "Slowenien",
  SI: "Slowenien",
  H: "Ungarn",
  HU: "Ungarn",
  CZ: "Tschechien",
  SK: "Slowakei",
  PL: "Polen",
  HR: "Kroatien",
  F: "Frankreich",
  FR: "Frankreich",
  NL: "Niederlande",
  B: "Belgien",
  BE: "Belgien",
  L: "Luxemburg",
  LU: "Luxemburg",
  DK: "Dänemark",
  S: "Schweden",
  SE: "Schweden",
  RO: "Rumänien",
  BG: "Bulgarien",
  E: "Spanien",
  ES: "Spanien",
  P: "Portugal",
  PT: "Portugal",
  GB: "Großbritannien",
  UK: "Großbritannien",
};

/** Ort und Land für den Empfängerblock: ["59174 Kamen", "Deutschland"]. */
function townAndCountry(town: string): [string, string] {
  const match = town.trim().match(/^([A-Za-z]{1,3})-\s*(.+)$/);
  if (!match) return [town.trim(), ""];
  const code = match[1].toUpperCase();
  if (code === "A" || code === "AT") return [town.trim(), ""];
  const country = COUNTRY_NAMES[code];
  return country ? [match[2].trim(), country] : [town.trim(), ""];
}

/** Hinweis bei 0 % USt — wie auf den Rechnungen an Auslandskunden. */
const REVERSE_CHARGE_TEXT = "Nach § 3a (6) UStG in Österreich nicht steuerbar. Reverse Charge";

/** Baut die .xlsx-Datei — ausschließlich aus dem gespeicherten Inhalt. */
async function buildWorkbook({ invoice, items }: InvoiceWithItems): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Rechnung", {
    pageSetup: PAGE_SETUP,
    properties: { defaultRowHeight: LINE_PT },
    // Ohne Blattansicht (<sheetViews>) in der Datei liest Excel jede
    // Zeilenhöhe um ein Fünftel zu niedrig ein — dann rutscht alles nach
    // oben und passt nicht mehr ins vorgedruckte Papier. Mit Ansicht stimmen
    // die Höhen auf den Punkt (in Excel nachgemessen).
    views: [{ state: "normal", showGridLines: false }],
  });

  // Arial 10 wie auf der Musterrechnung — ExcelJS' Standard wäre Calibri 11.
  const BASE_FONT = { name: "Arial", size: 10 };

  // Spalten so breit, dass alles dort steht, wo es auf der Musterrechnung
  // steht (Millimeter ab der linken Blattkante, Rand 19 mm):
  //   A 19–47: Datum, Beschriftungen unten
  //   B 47–70: Bezeichnung, "Ladestelle:", "pauschal"
  //   C 70–127: Ort und Datum der Lade-/Entladestelle
  //   D 127–152: rechter Kopfblock ("Belegnummer:"), "Übertrag:"
  //   E 152–158: "€"
  //   F 158–183: Betrag, rechtsbündig
  // Excel misst Spaltenbreiten in Zeichen der Standardschrift; umgerechnet
  // mit 7 px je Zeichen plus 5 px Rand bei 96 dpi. Excel druckt Spalten aber
  // nicht ganz so breit, wie es sie anzeigt; die Werte unten sind deshalb an
  // einem echten Excel-PDF nachgemessen und korrigiert, nicht nur gerechnet.
  const mmToWidth = (mm: number) => Math.round(((mm / 0.2646 - 5) / 7) * 100) / 100;
  sheet.columns = [
    { key: "a", width: mmToWidth(27.1) },
    { key: "b", width: mmToWidth(23.0) },
    { key: "c", width: mmToWidth(53.8) },
    { key: "d", width: mmToWidth(24.9) },
    { key: "e", width: mmToWidth(6.05) },
    { key: "f", width: mmToWidth(26.2) },
  ];

  type Col = "a" | "b" | "c" | "d" | "e" | "f";
  let next = 1;
  let used = 0; // Punkt, die auf der aktuellen Seite schon belegt sind

  /** Schreibt die nächste Zeile mit fester Höhe und gibt sie zurück. */
  function addRow(height: number, values: Partial<Record<Col, unknown>> = {}) {
    const row = sheet.getRow(next++);
    row.height = height;
    row.font = BASE_FONT;
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null && value !== "") {
        row.getCell(key).value = value as never;
      }
    }
    used += height;
    return row;
  }

  function money(row: ReturnType<typeof addRow>, amount: number | null) {
    row.getCell("e").value = "€";
    row.getCell("e").alignment = { horizontal: "right" };
    const cell = row.getCell("f");
    cell.value = amount;
    cell.numFmt = "#,##0.00";
    cell.alignment = { horizontal: "right" };
  }

  function underline(row: ReturnType<typeof addRow>, style: "thin" | "double") {
    for (const key of ["d", "e", "f"]) row.getCell(key).border = { bottom: { style } };
  }

  const name = invoice.empfaenger_name ?? "";
  const street = invoice.empfaenger_strasse ?? "";
  const [town, country] = townAndCountry(invoice.empfaenger_ort ?? "");
  let page = 0;
  let itemsOnPage = 0;

  /**
   * Kopf jeder Seite: Empfänger links, Rechnungsblock rechts, Tabellenkopf.
   * Auf jeder Seite gleich, nur die Seitenzahl wächst — so ist jedes Blatt
   * für sich zuzuordnen, wie auf den bisherigen Sammelrechnungen.
   */
  function writeHeader() {
    page += 1;
    used = 0;
    itemsOnPage = 0;

    const title = addRow(HEAD_PT.title, { a: name, d: "R e c h n u n g" });
    title.getCell("a").font = { ...BASE_FONT, size: 11 };
    title.getCell("d").font = { ...BASE_FONT, size: 13, bold: true };

    addRow(HEAD_PT.gap);
    const right: Array<[string, unknown]> = [
      ["Belegnummer:", invoice.belegnummer ?? ""],
      ["Datum:", toExcelDate(invoice.rechnungsdatum)],
      ["Seite:", page],
      ["Kundennummer:", invoice.kundennummer ?? ""],
      ["Ihre UID-Nr.:", invoice.uid_nummer ?? ""],
    ];
    const left = [street, town, country, "", ""];
    right.forEach(([label, value], i) => {
      const row = addRow(HEAD_PT.line, { a: left[i], d: label, f: value });
      row.getCell("f").alignment = { horizontal: "right" };
      if (i === 1) row.getCell("f").numFmt = "dd.mm.yyyy";
    });

    const head = addRow(HEAD_PT.tableHead, { a: "Datum", b: "Bezeichnung", f: "Preis" });
    head.font = { ...BASE_FONT, bold: true };
    addRow(HEAD_PT.afterTableHead);
  }

  /** "Übertrag:" mit der Summe bisher — am Ende einer Seite und oben auf der nächsten. */
  function writeCarry(amount: number) {
    const row = addRow(LINE_PT, { d: "Übertrag:" });
    row.getCell("d").font = { ...BASE_FONT, bold: true };
    money(row, amount);
    row.getCell("f").font = { ...BASE_FONT, bold: true };
    return row;
  }

  /** Seite voll: Übertrag unten, Umbruch, Kopf und Übertrag auf der neuen Seite. */
  function newPage(carried: number) {
    addRow(GAP_PT);
    const carry = writeCarry(carried);
    carry.getCell("f").border = { top: { style: "thin" }, bottom: { style: "thin" } };
    carry.addPageBreak();
    writeHeader();
    writeCarry(carried);
    addRow(GAP_PT);
  }

  // --- Positionen ------------------------------------------------------------
  type Line = { height: number; write: () => ReturnType<typeof addRow> };

  /** Alle Zeilen einer Position, damit sich vorher ausrechnen lässt, ob sie passt. */
  function itemLines(item: ItemRow): Line[] {
    const lines: Line[] = [];
    const push = (values: Partial<Record<Col, unknown>>, after?: (row: ReturnType<typeof addRow>) => void) =>
      lines.push({
        height: LINE_PT,
        write: () => {
          const row = addRow(LINE_PT, values);
          after?.(row);
          return row;
        },
      });

    push({ a: toExcelDate(item.position_datum), b: item.bezeichnung ?? "" }, (row) => {
      row.getCell("a").numFmt = "dd.mm.yyyy";
      row.getCell("b").font = { ...BASE_FONT, bold: true };
    });

    // Ohne Transportnummer bleibt die Zeile leer, statt ein nacktes
    // "Transportnr." zu drucken.
    const transportnr = item.transportnr?.trim();
    push({ b: transportnr ? `Transportnr. ${transportnr}` : "" }, (row) => {
      row.getCell("b").font = { ...BASE_FONT, bold: true };
    });

    const ladeDatum = toGermanDate(item.ladedatum);
    const entladeDatum = toGermanDate(item.entladedatum);
    push({ b: "Ladestelle:", c: item.ladestelle ?? "" });
    push({ c: ladeDatum ? `am ${ladeDatum}` : "" });
    push({ b: "Entladestelle:", c: item.entladestelle ?? "" });
    push({ c: entladeDatum ? `am ${entladeDatum}` : "" });

    const zusatz = (item.zusatztext ?? "").trim();
    if (zusatz) push({ b: zusatz });

    push({ b: "pauschal" }, (row) => money(row, toNumber(item.preis)));

    const diesel = dieselAmount(item);
    const prozent = toNumber(item.diesel_prozent);
    if (diesel !== null && prozent !== null) {
      push({ b: `Dieselzuschlag ${formatPercent(prozent)}` }, (row) => money(row, diesel));
    }

    lines.push({ height: GAP_PT, write: () => addRow(GAP_PT) });
    return lines;
  }

  writeHeader();
  let carried = 0;
  let lastPriceRow: ReturnType<typeof addRow> | null = null;

  for (const item of items) {
    const lines = itemLines(item);
    const height = lines.reduce((sum, line) => sum + line.height, 0);

    // Eine Position zerfällt nie auf zwei Blätter. Unten muss noch der
    // Übertrag Platz haben.
    if (used + height > PAGE_PT - CARRY_PT && itemsOnPage > 0) {
      newPage(carried);
    }

    for (const line of lines) {
      const row = line.write();
      if (row.getCell("f").value !== null && row.getCell("f").value !== undefined) lastPriceRow = row;
    }
    carried = roundCents(carried + (positionTotal(item) ?? 0));
    itemsOnPage += 1;
  }

  // Strich unter dem letzten Betrag, über dem Nettobetrag.
  if (lastPriceRow) underline(lastPriceRow, "thin");

  // --- Summen ----------------------------------------------------------------
  // Feste Zahlen, keine Formeln: sie dürfen vom Chef überschrieben sein (z. B.
  // ein vereinbarter Gesamtpreis), und eine Formel würde das beim Öffnen
  // wieder zurückrechnen. Fehlt jeder Preis, bleiben die Zellen leer.
  const totals = computeTotals({ invoice, items });
  const ustSatz = toNumber(invoice.ust_satz);
  const reverseCharge = ustSatz === 0;
  const totalsHeight = LINE_PT * (reverseCharge ? 5 : 4) + GAP_PT;

  if (used + totalsHeight > PAGE_PT) newPage(carried);

  const netto = addRow(LINE_PT, { a: "Nettobetrag gesamt:" });
  netto.font = { ...BASE_FONT, bold: true };
  money(netto, totals.netto);

  // "0 % Ust von EUR      4.704,11" — der Satz ist im Formular änderbar,
  // numeric kommt als "20.00" an.
  const ust = addRow(LINE_PT, {
    a: ustSatz === null ? "Ust von EUR" : `${String(ustSatz).replace(".", ",")} % Ust von EUR`,
    c: totals.netto,
  });
  ust.getCell("c").numFmt = "#,##0.00";
  // Linksbündig wie auf der Musterrechnung — Excel stellt Zahlen sonst rechts.
  ust.getCell("c").alignment = { horizontal: "left", indent: 2 };
  money(ust, totals.ust);
  underline(ust, "thin");

  const end = addRow(LINE_PT, { a: "Rechnungsendbetrag:" });
  end.font = { ...BASE_FONT, bold: true };
  money(end, totals.end);
  underline(end, "double");

  addRow(GAP_PT);
  const ziel = addRow(LINE_PT, { a: "Zahlungsziel:", b: invoice.zahlungsziel ?? "" });
  ziel.getCell("a").font = { ...BASE_FONT, bold: true };

  if (reverseCharge) addRow(LINE_PT, { a: REVERSE_CHARGE_TEXT });

  return await workbook.xlsx.writeBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient) {
    return json({ error }, status ?? 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // Kein oder kaputtes JSON — unten als fehlende Angaben behandelt.
  }

  const action = typeof body.action === "string" ? body.action : "export";
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";

  try {
    switch (action) {
      case "load":
        if (!orderId) throw new HttpError("orderId fehlt.", 400);
        return json(await handleLoad(adminClient, orderId));

      case "create":
        return json(await handleCreate(adminClient, parseOrderIds(body.orderIds)));

      case "addItems":
        if (!invoiceId) throw new HttpError("invoiceId fehlt.", 400);
        return json(await handleAddItems(adminClient, invoiceId, parseOrderIds(body.orderIds)));

      case "removeItem": {
        const itemId = typeof body.itemId === "string" ? body.itemId : "";
        if (!invoiceId || !itemId) throw new HttpError("invoiceId oder itemId fehlt.", 400);
        return json(await handleRemoveItem(adminClient, invoiceId, itemId));
      }

      case "export": {
        if (!invoiceId) throw new HttpError("invoiceId fehlt.", 400);
        const invoice = await loadInvoiceById(adminClient, invoiceId);
        const buffer = await buildWorkbook(invoice);
        const fileName = `Rechnung_${(invoice.invoice.belegnummer ?? "").replace(/\//g, "-")}.xlsx`;

        return new Response(buffer, {
          headers: {
            ...corsHeaders,
            // octet-stream, nicht der exakte xlsx-Typ: supabase-js entscheidet in
            // functions.invoke am Content-Type, wie der Body gelesen wird, und
            // macht aus allem Unbekannten UTF-8-Text — die Binärdatei wäre
            // zerstört. Den richtigen Typ setzt der Client beim Speichern.
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        });
      }

      default:
        return json({ error: `Unbekannte Aktion "${action}".` }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return internalError("export-invoice", e);
  }
});
