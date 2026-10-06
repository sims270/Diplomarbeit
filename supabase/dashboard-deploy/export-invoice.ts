// ============================================================================
// export-invoice — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/export-invoice/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts und _shared/verify-boss.ts
// stehen hier inline. Der Dashboard-Editor legt die eingefuegte Datei allein
// unter /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
//
// Sobald die Supabase CLI eingerichtet ist, ist die Repo-Fassung die
// massgebliche und diese Datei wird nicht mehr gebraucht.
// ============================================================================

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
// umgebrochen; jede Folgeseite liegt wieder auf dem vorgedruckten Papier.
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

import ExcelJS from "npm:exceljs@4.4.0";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "jsr:@supabase/supabase-js@2";

// --- aus _shared/cors.ts ----------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- aus _shared/verify-boss.ts ---------------------------------------------
interface VerifyBossResult {
  caller?: User;
  adminClient?: SupabaseClient;
  error?: string;
  status?: number;
}

// Confirms the request carries a valid session for a "boss" account, then
// hands back an admin client (service_role) for the caller to use. The
// service_role key never leaves this server-side runtime.
async function verifyBoss(req: Request): Promise<VerifyBossResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Missing Authorization header", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Scoped to the caller's own JWT — only used to find out who's calling.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return { error: "Invalid or expired session", status: 401 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Die Rolle aus public.profiles, nicht aus dem user_metadata — das kann
  // jeder Nutzer selbst ändern.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 };
  }
  if (profile?.role !== "boss") {
    return { error: "Only a boss account can do this", status: 403 };
  }

  return { caller, adminClient };
}

interface OrderRow {
  id: string;
  order_nr: string;
  status: string;
  loading_date: string | null;
  loading_company: string;
  loading_address: string;
  loading_meters: string;
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
  "unloading_date, unloading_company, unloading_address, client_company, client_address";

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
  /** Nur zur Anzeige im Formular — welcher Auftrag hinter der Position steht. */
  order_nr?: string;
}

const ITEM_COLUMNS =
  "id, order_id, external_order_id, reihenfolge, position_datum, bezeichnung, transportnr, " +
  "ladestelle, ladedatum, entladestelle, entladedatum, preis, orders(order_nr), " +
  "external_orders(order_nr)";

interface InvoiceWithItems {
  invoice: InvoiceRow;
  items: ItemRow[];
}

/**
 * Ränder in Zoll, damit der Druck in die Lücke des vorgedruckten Papiers
 * fällt. Gemessen an der Musterrechnung: der Briefkopf endet rund 60 mm
 * unter der Blattkante, das Flottenfoto beginnt rund 75 mm über der
 * Unterkante. Dazwischen bleiben auf A4 etwa 160 mm für die Rechnung.
 */
const PAGE_SETUP = {
  paperSize: 9, // A4
  orientation: "portrait" as const,
  margins: {
    top: 2.4, // ~60 mm — unter dem vorgedruckten Briefkopf
    bottom: 3.0, // ~76 mm — über dem vorgedruckten Foto
    left: 0.79, // ~20 mm, bündig mit dem Briefkopf
    right: 0.39,
    header: 0,
    footer: 0,
  },
};

/**
 * Feste Zeilenhöhe in Punkt, damit sich ausrechnen lässt, wie viel auf eine
 * Seite passt. 160 mm sind rund 453 pt, bei 13 pt also knapp 35 Zeilen —
 * mit etwas Luft, damit Excel nicht von sich aus schon früher umbricht und
 * mitten in einer Position eine zweite, eigene Seite beginnt.
 */
const ROW_HEIGHT = 13;
const ROWS_PER_PAGE = 33;

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
  const prices = items
    .map((item) => toNumber(item.preis))
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
 * "1 Ladung" bzw. "1 Ladung, 13,6 Lademeter". Auf der Musterrechnung steht
 * an dieser Stelle das Gewicht ("24.000 kg") — das erfasst die App nicht,
 * wohl aber die Lademeter aus dem Auftrag. Fehlen die, bleibt es bei der
 * schlichten Angabe, statt eine Zahl zu erfinden. Der Chef kann die
 * Bezeichnung anschließend im Formular überschreiben.
 */
function buildDescription(loadingMeters: string): string {
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

  if (own.error) throw new HttpError(own.error.message, 400);
  if (external.error) throw new HttpError(external.error.message, 400);

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

/** Position aus dem Auftrag vorbefüllt. Der Preis bleibt leer — er wird ausgehandelt. */
function itemPrefill(order: OrderRow) {
  const loading = splitAddress(order.loading_address);
  const unloading = splitAddress(order.unloading_address);

  return {
    position_datum: order.loading_date,
    bezeichnung: buildDescription(order.loading_meters),
    transportnr: order.order_nr,
    ladestelle: loading.town ? `lt. Weisung in ${loading.town}` : "",
    ladedatum: order.loading_date,
    entladestelle: unloading.town ? `lt. Weisung in ${unloading.town}` : "",
    entladedatum: order.unloading_date,
    preis: null,
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

  for (const item of emptyItems) {
    const order = orders.get(item.order_id);
    if (!order) continue;
    const { error: itemError } = await adminClient
      .from("invoice_items")
      .update(itemPrefill(order))
      .eq("id", item.id);
    if (itemError) throw new HttpError(itemError.message, 400);
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
    if (headerError) throw new HttpError(headerError.message, 400);
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

  if (invoiceResult.error) throw new HttpError(invoiceResult.error.message, 400);
  if (itemsResult.error) throw new HttpError(itemsResult.error.message, 400);
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

  if (error) throw new HttpError(error.message, 400);
  if (!data) return { invoice: null, items: [] };

  const invoiceId = (data as { invoice_id: string }).invoice_id;
  // Rechnungen, die vor dieser Fassung angelegt wurden, können noch
  // unbefüllte Felder haben — beim Öffnen nachholen.
  await prefillInvoice(adminClient, invoiceId);
  return await loadInvoiceById(adminClient, invoiceId);
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
        : `Rechnung konnte nicht angelegt werden: ${error.message}`,
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
        : error.message,
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
  if (error) throw new HttpError(error.message, 400);

  return await loadInvoiceById(adminClient, invoiceId);
}

/** Baut die .xlsx-Datei — ausschließlich aus dem gespeicherten Inhalt. */
async function buildWorkbook({ invoice, items }: InvoiceWithItems): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Rechnung", {
    pageSetup: PAGE_SETUP,
    properties: { defaultRowHeight: ROW_HEIGHT },
  });

  // Arial 10 wie auf der bisherigen Rechnung — ExcelJS' Standard wäre
  // Calibri 11 und damit sichtbar breiter als der vorgedruckte Briefkopf.
  const BASE_FONT = { name: "Arial", size: 10 };

  // A: Datum/Beschriftungen, B: "Ladestelle:", C: Fließtext,
  // D: Währungszeichen, E: Betrag. Zusammen rund 168 mm — passt zwischen
  // die Druckränder oben.
  sheet.columns = [
    { key: "a", width: 13 },
    { key: "b", width: 13 },
    { key: "c", width: 36 },
    { key: "d", width: 4 },
    { key: "e", width: 14 },
  ];

  /** Setzt Werte einer Zeile über die Spaltenbuchstaben und gibt sie zurück. */
  function writeRow(
    rowNumber: number,
    values: Partial<Record<"a" | "b" | "c" | "d" | "e", unknown>>,
  ) {
    const row = sheet.getRow(rowNumber);
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) row.getCell(key).value = value as never;
    }
    row.font = BASE_FONT;
    row.height = ROW_HEIGHT;
    return row;
  }

  function writeTableHeader(rowNumber: number) {
    const headerRow = writeRow(rowNumber, { a: "Datum", b: "Bezeichnung", e: "Preis" });
    headerRow.font = { ...BASE_FONT, bold: true };
    headerRow.getCell("e").alignment = { horizontal: "center" };
    for (const key of ["a", "b", "c", "d", "e"]) {
      headerRow.getCell(key).border = { bottom: { style: "thin" } };
    }
  }

  // Die Seitenzahl im Kopf steht erst fest, wenn alle Positionen verteilt
  // sind — deshalb wird sie am Ende nachgetragen.
  const pageNumberCells: Array<{ row: number; page: number }> = [];

  // --- Empfänger und Rechnungskopf -----------------------------------------
  const titleRow = writeRow(1, {
    a: invoice.empfaenger_name ?? "",
    c: "R e c h n u n g",
  });
  titleRow.getCell("a").font = { ...BASE_FONT, size: 11 };
  titleRow.getCell("c").font = { ...BASE_FONT, size: 13, bold: true };

  writeRow(2, {
    a: invoice.empfaenger_strasse ?? "",
    c: "Belegnummer:",
    e: invoice.belegnummer ?? "",
  });
  writeRow(3, {
    a: invoice.empfaenger_ort ?? "",
    c: "Datum:",
    e: toExcelDate(invoice.rechnungsdatum),
  });
  writeRow(4, { c: "Seite:" });
  pageNumberCells.push({ row: 4, page: 1 });
  writeRow(5, { c: "Kundennummer:", e: invoice.kundennummer ?? "" });
  writeRow(6, { c: "Ihre UID-Nr.:", e: invoice.uid_nummer ?? "" });

  for (const rowNumber of [2, 4, 5, 6]) {
    sheet.getRow(rowNumber).getCell("e").alignment = { horizontal: "right" };
  }
  sheet.getRow(3).getCell("e").numFmt = "dd.mm.yyyy";
  sheet.getRow(3).getCell("e").alignment = { horizontal: "right" };

  writeTableHeader(8);

  let page = 1;
  let pageStart = 1;
  let next = 9;

  /**
   * Bricht vor einem Block um, der nicht mehr ganz auf die Seite passt —
   * eine Position soll nie auf zwei Blätter zerfallen. Die Folgeseite
   * beginnt mit Belegnummer, Seitenzahl und dem Tabellenkopf, damit jedes
   * Blatt für sich zuzuordnen ist.
   */
  function ensureRoom(rows: number) {
    if (next - pageStart + rows <= ROWS_PER_PAGE) return;

    sheet.getRow(next - 1).addPageBreak();
    page += 1;
    pageStart = next;

    const continued = writeRow(next, {
      a: invoice.belegnummer ? `Rechnung ${invoice.belegnummer}` : "Rechnung",
      c: "Seite:",
    });
    continued.getCell("a").font = { ...BASE_FONT, bold: true };
    continued.getCell("e").alignment = { horizontal: "right" };
    pageNumberCells.push({ row: next, page });

    writeTableHeader(next + 2);
    next += 3;
  }

  // --- Positionen ------------------------------------------------------------
  // Die Einzelrechnung sieht aus wie bisher: Ort und "am <Datum>"
  // zweizeilig, sieben Zeilen je Position. Auf der Sammelrechnung steht
  // beides in einer Zeile ("lt. Weisung in A-8770 Musterdorf am 01.09.2026")
  // — sonst passen schon drei Ladungen samt Summen nicht mehr auf ein Blatt.
  // Dazu je eine Leerzeile als Abstand.
  const compact = items.length > 1;
  const ITEM_ROWS = compact ? 6 : 8;

  /** "lt. Weisung in <Ort>" plus Datum — je nach Layout angehängt oder als eigene Zeile. */
  function siteLines(site: string | null, isoDate: string | null): [string, string] {
    const date = toGermanDate(isoDate);
    const text = site ?? "";
    if (!compact) return [text, date ? `am ${date}` : ""];
    return [date ? `${text} am ${date}`.trim() : text, ""];
  }

  for (const item of items) {
    ensureRoom(ITEM_ROWS);
    const r = next;

    const positionRow = writeRow(r, {
      a: toExcelDate(item.position_datum),
      b: item.bezeichnung ?? "",
    });
    positionRow.getCell("a").numFmt = "dd.mm.yyyy";
    positionRow.getCell("b").font = { ...BASE_FONT, bold: true };

    // Ohne Transportnummer bleibt die Zeile leer, statt ein nacktes
    // "Transportnr." zu drucken.
    const transportnr = item.transportnr?.trim();
    const transportRow = writeRow(r + 1, { b: transportnr ? `Transportnr. ${transportnr}` : "" });
    transportRow.getCell("b").font = { ...BASE_FONT, bold: true };

    const [ladeText, ladeDatum] = siteLines(item.ladestelle, item.ladedatum);
    const [entladeText, entladeDatum] = siteLines(item.entladestelle, item.entladedatum);

    let line = r + 2;
    writeRow(line++, { b: "Ladestelle:", c: ladeText });
    if (!compact) writeRow(line++, { c: ladeDatum });
    writeRow(line++, { b: "Entladestelle:", c: entladeText });
    if (!compact) writeRow(line++, { c: entladeDatum });

    const pauschalRow = writeRow(line, { b: "pauschal", d: "€", e: toNumber(item.preis) });
    pauschalRow.getCell("e").border = { bottom: { style: "thin" } };
    pauschalRow.getCell("e").numFmt = "#,##0.00";
    pauschalRow.getCell("e").alignment = { horizontal: "right" };
    pauschalRow.getCell("d").alignment = { horizontal: "right" };

    next = r + ITEM_ROWS;
  }

  // --- Summen --------------------------------------------------------------
  // Die Beträge als feste Zahlen, keine Formeln: sie dürfen vom Chef
  // überschrieben sein (z. B. ein vereinbarter Gesamtpreis), und eine Formel
  // würde das beim Öffnen wieder zurückrechnen. Fehlt jeder Preis, bleiben
  // die Zellen leer wie bisher.
  ensureRoom(5);
  const s = next;
  const totals = computeTotals({ invoice, items });

  const nettoRow = writeRow(s, { a: "Nettobetrag gesamt:", d: "€", e: totals.netto });
  nettoRow.font = { ...BASE_FONT, bold: true };

  // Der Satz ist im Formular änderbar; numeric kommt als "20.00" an und
  // soll auf der Rechnung als "20 %" stehen.
  const ustSatz = toNumber(invoice.ust_satz);
  const ustRow = writeRow(s + 1, {
    a: ustSatz === null ? "Ust von EUR" : `${ustSatz} % Ust von EUR`,
    d: "€",
    e: totals.ust,
  });
  ustRow.getCell("e").border = { bottom: { style: "thin" } };

  const endRow = writeRow(s + 2, { a: "Rechnungsendbetrag:", d: "€", e: totals.end });
  endRow.font = { ...BASE_FONT, bold: true };
  endRow.getCell("e").border = { bottom: { style: "double" } };

  writeRow(s + 4, { a: "Zahlungsziel:", b: invoice.zahlungsziel ?? "" });
  sheet.getRow(s + 4).getCell("a").font = { ...BASE_FONT, bold: true };

  // Beträge einheitlich mit zwei Nachkommastellen, rechtsbündig.
  for (const rowNumber of [s, s + 1, s + 2]) {
    const cell = sheet.getRow(rowNumber).getCell("e");
    cell.numFmt = "#,##0.00";
    cell.alignment = { horizontal: "right" };
    sheet.getRow(rowNumber).getCell("d").alignment = { horizontal: "right" };
  }

  // "1" bei einer Seite wie bisher, sonst "1 von 2".
  for (const { row, page: pageNumber } of pageNumberCells) {
    sheet.getRow(row).getCell("e").value = page === 1 ? 1 : `${pageNumber} von ${page}`;
  }

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
    return json({ error: e instanceof Error ? e.message : "Rechnung konnte nicht verarbeitet werden." }, 400);
  }
});
