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
// Zwei Aufgaben rund um die Rechnung zu einem erledigten Auftrag:
//
//   action "load"   — liefert den Rechnungsinhalt als JSON für das
//                     Bearbeitungsformular im Chef-Dashboard. Existiert
//                     noch keine Rechnung, wird sie hier angelegt: die
//                     Belegnummer vergeben und die Felder aus dem Auftrag
//                     vorbefüllt.
//   action "export" — baut daraus die .xlsx-Datei (Vorgabe, wenn nichts
//                     angegeben ist).
//
// Beide Wege gehen durch dieselbe Vorbefüllung (ensureInvoice), damit es
// nur eine Stelle gibt, die weiß, wie aus einem Auftrag eine Rechnung wird.
// Gedruckt wird ausschließlich, was in der Tabelle invoices steht — der
// Auftrag wird nach dem Anlegen nicht mehr gelesen. Ändert der Chef die
// Rechnung, bleibt der Auftrag unangetastet: er dokumentiert die Fahrt, die
// Rechnung das Geschäft.
//
// Bewusst nur "der Rest" der Rechnung: Briefkopf oben und das Foto der
// LKW-Flotte unten sind auf dem Rechnungspapier vorgedruckt. Die Datei
// füllt also nur den freien Bereich dazwischen — freigehalten wird er über
// die Druckränder (siehe PAGE_SETUP), nicht über leere Zeilen. Auf dem
// Bildschirm beginnt die Rechnung damit ganz oben im Blatt, beim Druck
// rutscht sie unter den vorgedruckten Briefkopf.
//
// Warum Edge Function und nicht im Client: exceljs ist keine Abhängigkeit
// der App (siehe package.json), und alle privilegierten Serveraufgaben
// dieses Projekts laufen bereits als Edge Function mit verifyBoss — so wie
// export-tank-entries, an dem sich diese Function auch sonst orientiert.
//

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

  if (caller.user_metadata?.role !== "boss") {
    return { error: "Only a boss account can do this", status: 403 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { caller, adminClient };
}

interface OrderRow {
  order_nr: string;
  status: string;
  loading_date: string | null;
  loading_company: string;
  loading_address: string;
  loading_meters: string;
  unloading_date: string | null;
  unloading_company: string;
  unloading_address: string;
}

/**
 * Der Rechnungsinhalt, wie er in public.invoices steht — jedes Feld
 * bearbeitbar im Formular des Chef-Dashboards.
 *
 * numeric-Spalten liefert PostgREST als String, damit keine
 * Nachkommastellen verloren gehen; für die Excel-Zelle werden sie in echte
 * Zahlen umgewandelt (toNumber).
 */
interface InvoiceRow {
  order_id: string;
  belegnummer: string | null;
  rechnungsdatum: string | null;
  empfaenger_name: string | null;
  empfaenger_strasse: string | null;
  empfaenger_ort: string | null;
  kundennummer: string | null;
  uid_nummer: string | null;
  position_datum: string | null;
  bezeichnung: string | null;
  transportnr: string | null;
  ladestelle: string | null;
  ladedatum: string | null;
  entladestelle: string | null;
  entladedatum: string | null;
  preis: string | number | null;
  ust_satz: string | number | null;
  zahlungsziel: string | null;
}

const INVOICE_COLUMNS =
  "order_id, belegnummer, rechnungsdatum, empfaenger_name, empfaenger_strasse, " +
  "empfaenger_ort, kundennummer, uid_nummer, position_datum, bezeichnung, " +
  "transportnr, ladestelle, ladedatum, entladestelle, entladedatum, preis, " +
  "ust_satz, zahlungsziel";

/**
 * Ränder in Zoll, damit der Druck in die Lücke des vorgedruckten Papiers
 * fällt. Gemessen an der Musterrechnung: der Briefkopf endet rund 60 mm
 * unter der Blattkante, das Flottenfoto beginnt rund 75 mm über der
 * Unterkante. Dazwischen bleiben auf A4 etwa 160 mm für die Rechnung
 * selbst — mehr als genug für die gut 20 Zeilen, die hier entstehen.
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
}

/**
 * Kundenstammdaten der Ladestelle aus site_companies — bmd_kto_nr ist die
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

  const columns = "bmd_kto_nr, uid_nummer";

  const exact = await adminClient
    .from("site_companies")
    .select(columns)
    .eq("name", name)
    .maybeSingle();

  if (exact.error) {
    console.warn("[export-invoice] Kundendaten nicht lesbar:", exact.error.message);
    return null;
  }
  if (exact.data) return exact.data as CustomerRow;

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

/**
 * Die Rechnung zum Auftrag, angelegt und aus dem Auftrag vorbefüllt, falls
 * es sie noch nicht gibt. Existiert sie bereits, wird sie unverändert
 * zurückgegeben — was der Chef im Formular geändert hat, überschreibt hier
 * nichts.
 */
async function ensureInvoice(
  adminClient: SupabaseClient,
  orderId: string,
  order: OrderRow,
): Promise<InvoiceRow> {
  const existing = await adminClient
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data && (existing.data as InvoiceRow).belegnummer !== null) {
    return existing.data as InvoiceRow;
  }

  // Ab hier zwei Fälle, die beide dieselbe Behandlung brauchen: es gibt
  // noch keine Zeile, oder es gibt eine ohne Inhalt — letzteres bei
  // Rechnungen, die vor Einführung der bearbeitbaren Felder erzeugt wurden.
  //
  // assign_invoice_number deckt beides ab: eine vorhandene Nummer gibt sie
  // unverändert zurück, sonst vergibt sie die nächste — beim ersten Mal
  // "01/2026", im nächsten Jahr wieder "01/2027" (siehe
  // supabase/migrations/20260910120000_create_invoices.sql).
  const rechnungsdatum = heuteInOesterreich();
  const { data: belegnummer, error: belegError } = await adminClient.rpc(
    "assign_invoice_number",
    { p_order_id: orderId, p_jahr: Number(rechnungsdatum.slice(0, 4)) },
  );

  if (belegError) {
    throw new Error(`Belegnummer konnte nicht vergeben werden: ${belegError.message}`);
  }

  const loading = splitAddress(order.loading_address);
  const unloading = splitAddress(order.unloading_address);
  const customer = await loadCustomer(adminClient, order.loading_company);

  // Der Preis bleibt leer: er wird pro Fahrt ausgehandelt und steht
  // nirgends in der App. Genau dafür gibt es das Formular.
  const prefill = {
    belegnummer,
    rechnungsdatum,
    empfaenger_name: order.loading_company,
    empfaenger_strasse: loading.street,
    empfaenger_ort: loading.town,
    kundennummer: buildKundennummer(customer?.bmd_kto_nr, loading.town),
    uid_nummer: customer?.uid_nummer ?? "",
    position_datum: order.loading_date,
    bezeichnung: buildDescription(order.loading_meters),
    transportnr: order.order_nr,
    ladestelle: loading.town ? `lt. Weisung in ${loading.town}` : "",
    ladedatum: order.loading_date,
    entladestelle: unloading.town ? `lt. Weisung in ${unloading.town}` : "",
    entladedatum: order.unloading_date,
    preis: null,
    ust_satz: MWST_SATZ,
    zahlungsziel: ZAHLUNGSZIEL,
  };

  const filled = await adminClient
    .from("invoices")
    .update(prefill)
    .eq("order_id", orderId)
    .select(INVOICE_COLUMNS)
    .single();

  if (filled.error) throw new Error(filled.error.message);
  return filled.data as InvoiceRow;
}

/** Baut die .xlsx-Datei — ausschließlich aus dem gespeicherten Inhalt. */
async function buildWorkbook(invoice: InvoiceRow): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Rechnung", { pageSetup: PAGE_SETUP });

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
    return row;
  }

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
  writeRow(4, { c: "Seite:", e: 1 });
  writeRow(5, { c: "Kundennummer:", e: invoice.kundennummer ?? "" });
  writeRow(6, { c: "Ihre UID-Nr.:", e: invoice.uid_nummer ?? "" });

  for (const rowNumber of [2, 4, 5, 6]) {
    sheet.getRow(rowNumber).getCell("e").alignment = { horizontal: "right" };
  }
  sheet.getRow(3).getCell("e").numFmt = "dd.mm.yyyy";
  sheet.getRow(3).getCell("e").alignment = { horizontal: "right" };

  // --- Positionstabelle ----------------------------------------------------
  const headerRow = writeRow(8, { a: "Datum", b: "Bezeichnung", e: "Preis" });
  headerRow.font = { ...BASE_FONT, bold: true };
  headerRow.getCell("e").alignment = { horizontal: "center" };
  for (const key of ["a", "b", "c", "d", "e"]) {
    headerRow.getCell(key).border = { bottom: { style: "thin" } };
  }

  const positionRow = writeRow(9, {
    a: toExcelDate(invoice.position_datum),
    b: invoice.bezeichnung ?? "",
  });
  positionRow.getCell("a").numFmt = "dd.mm.yyyy";
  positionRow.getCell("b").font = { ...BASE_FONT, bold: true };

  // Ohne Transportnummer bleibt die Zeile leer, statt ein nacktes
  // "Transportnr." zu drucken.
  const transportnr = invoice.transportnr?.trim();
  const transportRow = writeRow(10, { b: transportnr ? `Transportnr. ${transportnr}` : "" });
  transportRow.getCell("b").font = { ...BASE_FONT, bold: true };

  // "lt. Weisung in <Ort>" und darunter "am <Datum>" — zweizeilig wie auf
  // der bisherigen Rechnung.
  const ladedatum = toGermanDate(invoice.ladedatum);
  const entladedatum = toGermanDate(invoice.entladedatum);

  writeRow(11, { b: "Ladestelle:", c: invoice.ladestelle ?? "" });
  writeRow(12, { c: ladedatum ? `am ${ladedatum}` : "" });
  writeRow(13, { b: "Entladestelle:", c: invoice.entladestelle ?? "" });
  writeRow(14, { c: entladedatum ? `am ${entladedatum}` : "" });

  const pauschalRow = writeRow(15, { b: "pauschal", d: "€", e: toNumber(invoice.preis) });
  pauschalRow.getCell("e").border = { bottom: { style: "thin" } };

  // --- Summen --------------------------------------------------------------
  // Nur die Beschriftungen: die Beträge trägt die Buchhaltung wie bisher
  // selbst ein, hier steht bewusst keine Formel.
  const nettoRow = writeRow(17, { a: "Nettobetrag gesamt:", d: "€" });
  nettoRow.font = { ...BASE_FONT, bold: true };

  // Der Satz ist im Formular änderbar; numeric kommt als "20.00" an und
  // soll auf der Rechnung als "20 %" stehen.
  const ustSatz = toNumber(invoice.ust_satz);
  const ustRow = writeRow(18, {
    a: ustSatz === null ? "Ust von EUR" : `${ustSatz} % Ust von EUR`,
    d: "€",
  });
  ustRow.getCell("e").border = { bottom: { style: "thin" } };

  const endRow = writeRow(19, { a: "Rechnungsendbetrag:", d: "€" });
  endRow.font = { ...BASE_FONT, bold: true };
  endRow.getCell("e").border = { bottom: { style: "double" } };

  writeRow(21, { a: "Zahlungsziel:", b: invoice.zahlungsziel ?? "" });
  sheet.getRow(21).getCell("a").font = { ...BASE_FONT, bold: true };

  // Beträge einheitlich mit zwei Nachkommastellen, rechtsbündig.
  for (const rowNumber of [15, 17, 18, 19]) {
    const cell = sheet.getRow(rowNumber).getCell("e");
    cell.numFmt = "#,##0.00";
    cell.alignment = { horizontal: "right" };
    sheet.getRow(rowNumber).getCell("d").alignment = { horizontal: "right" };
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

  let orderId: string | undefined;
  let action = "export";
  try {
    const body = await req.json();
    orderId = body?.orderId;
    if (body?.action === "load") action = "load";
  } catch {
    // Kein oder kaputtes JSON — unten als fehlende orderId behandelt.
  }

  if (!orderId) {
    return json({ error: "orderId fehlt." }, 400);
  }

  const { data, error: queryError } = await adminClient
    .from("orders")
    .select(
      "order_nr, status, loading_date, loading_company, loading_address, loading_meters, unloading_date, unloading_company, unloading_address",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (queryError) {
    return json({ error: queryError.message }, 400);
  }
  if (!data) {
    return json({ error: "Auftrag nicht gefunden." }, 404);
  }

  const order = data as OrderRow;

  // Abgerechnet wird, was gefahren wurde. Der Bereich erscheint ohnehin
  // erst beim erledigten Auftrag — die Regel gehört trotzdem hierher, damit
  // sie nicht allein an der Oberfläche hängt (gleiche Aufteilung wie bei
  // den Auftragsdokumenten, siehe app/services/orderDocumentService.ts).
  if (order.status !== "completed") {
    return json(
      { error: "Die Rechnung gibt es erst, wenn der Fahrer den Auftrag als erledigt markiert hat." },
      409,
    );
  }

  let invoice: InvoiceRow;
  try {
    invoice = await ensureInvoice(adminClient, orderId, order);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Rechnung konnte nicht angelegt werden." }, 400);
  }

  if (action === "load") {
    return json({ invoice });
  }

  const buffer = await buildWorkbook(invoice);
  const fileName = `Rechnung_${order.order_nr}.xlsx`;

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
});
