// ============================================================================
// export-external-profit — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/export-external-profit/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts und _shared/verify-boss.ts stehen
// hier inline. Der Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
// ============================================================================

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

// -------------------------------------------------------------- _shared/errors
const INTERNAL_ERROR_MESSAGE = "Interner Fehler. Bitte später erneut versuchen.";

// Meldungen von Postgres und Auth verraten Tabellen- und Constraint-Namen.
// Die Details landen deshalb nur im Log der Function.
function internalError(context: string, cause: unknown): Response {
  console.error(`[${context}]`, cause);
  return json({ error: INTERNAL_ERROR_MESSAGE }, 500);
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
    console.error("[verify-boss]", profileError);
    return { error: INTERNAL_ERROR_MESSAGE, status: 500 };
  }
  if (profile?.role !== "boss") {
    return { error: "Only a boss account can do this", status: 403 };
  }

  return { caller, adminClient };
}

// --- die eigentliche Function ----------------------------------------------
interface OrderRow {
  id: string;
  order_nr: string;
  loading_date: string | null;
  unloading_date: string | null;
  completed_at: string | null;
  client_company: string | null;
  loading_company: string | null;
  recipient_company: string | null;
  freight_rate: string | null;
  deadline_surcharge: string | null;
  customer_price: string | number | null;
}

interface InvoiceItemRow {
  external_order_id: string;
  preis: string | number | null;
}

interface ProfitRow {
  orderNr: string;
  date: string;
  from: string;
  to: string;
  income: number | null;
  expense: number | null;
}

const PAGE_SIZE = 1000;
const FIRST_DATA_ROW = 3;

const PRIMARY = "FF9B2321";
const PRIMARY_SOFT = "FFF6DEDD";
const EURO = '"€" #,##0.00;[Red]-"€" #,##0.00';

const COLUMNS = [
  { header: "Auftragsnummer", width: 17 },
  { header: "Auftragsdatum", width: 15 },
  { header: "von Firma", width: 30 },
  { header: "an Spedition", width: 30 },
  { header: "Eingang in Euro", width: 17 },
  { header: "Ausgang in Euro", width: 17 },
  { header: "Gewinn in Euro", width: 17 },
];

const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const thick = { style: "medium" as const, color: { argb: PRIMARY } };

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

// numeric kommt aus PostgREST als String.
function toNumberOrNull(value: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Frachtsatz und Terminzuschlag sind Freitext ("1.300,00", "1300", "1 300 €").
 * Leer heißt 0; null heißt, der Betrag ist nicht lesbar und fällt in der
 * Liste auf, statt still als 0 den Gewinn zu verfälschen.
 */
function parseGermanAmount(raw: string | null): number | null {
  const cleaned = (raw ?? "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(cleaned)
    ? cleaned.replace(/\./g, "")
    : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toViennaIsoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(date);
}

function orderDate(order: OrderRow): string | null {
  if (order.loading_date) return order.loading_date;
  if (order.unloading_date) return order.unloading_date;
  return order.completed_at ? toViennaIsoDate(new Date(order.completed_at)) : null;
}

// Siehe export-tank-entries: mittags verankert, damit das Datum beim
// Umrechnen in die Excel-Serienzahl nicht auf den Vortag kippt.
function toExcelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function monthName(monthKey: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-15T12:00:00Z`));
}

// PostgREST liefert höchstens 1000 Zeilen je Abfrage.
async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function buildMonths(
  orders: OrderRow[],
  invoicePrices: Map<string, number>,
): Map<string, ProfitRow[]> {
  const months = new Map<string, ProfitRow[]>();

  for (const order of orders) {
    const date = orderDate(order);
    if (!date) continue;

    const freight = parseGermanAmount(order.freight_rate);
    const surcharge = parseGermanAmount(order.deadline_surcharge);

    const row: ProfitRow = {
      orderNr: order.order_nr,
      date,
      from: (order.client_company ?? "").trim() || (order.loading_company ?? "").trim(),
      to: (order.recipient_company ?? "").trim(),
      income: invoicePrices.get(order.id) ?? toNumberOrNull(order.customer_price),
      expense: freight === null || surcharge === null ? null : roundCents(freight + surcharge),
    };

    const key = date.slice(0, 7);
    const rows = months.get(key);
    if (rows) rows.push(row);
    else months.set(key, [row]);
  }

  for (const rows of months.values()) {
    rows.sort((a, b) =>
      a.date.localeCompare(b.date) || a.orderNr.localeCompare(b.orderNr, "de", { numeric: true })
    );
  }
  return months;
}

function addMonthSheet(workbook: ExcelJS.Workbook, monthKey: string, rows: ProfitRow[]): void {
  const name = monthName(monthKey);
  const sheet = workbook.addWorksheet(name, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: FIRST_DATA_ROW - 1 }],
  });

  COLUMNS.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  const title = sheet.getCell("A1");
  title.value = `Auftragsaufzeichnungen ${name}`;
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill = solid(PRIMARY);
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.border = { top: thick, left: thick, right: thick, bottom: thick };
  // Erst nach dem Formatieren verbinden, siehe export-tank-entries.
  sheet.mergeCells("A1:G1");
  sheet.getRow(1).height = 30;

  const header = sheet.getRow(2);
  header.height = 24;
  COLUMNS.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: PRIMARY } };
    cell.fill = solid(PRIMARY_SOFT);
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: thick,
      bottom: thick,
      left: index === 0 ? thick : thin,
      right: index === COLUMNS.length - 1 ? thick : thin,
    };
  });

  rows.forEach((row, index) => {
    const rowNumber = FIRST_DATA_ROW + index;
    const excelRow = sheet.getRow(rowNumber);
    excelRow.height = 18;

    // Als Zahl, sonst markiert Excel jede Zeile als "Zahl als Text gespeichert".
    excelRow.getCell(1).value = /^\d+$/.test(row.orderNr) ? Number(row.orderNr) : row.orderNr;
    excelRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    excelRow.getCell(2).value = toExcelDate(row.date);
    excelRow.getCell(2).numFmt = "dd.mm.yyyy";
    excelRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    excelRow.getCell(3).value = row.from;
    excelRow.getCell(4).value = row.to;
    excelRow.getCell(5).value = row.income;
    excelRow.getCell(6).value = row.expense;

    if (row.income !== null && row.expense !== null) {
      excelRow.getCell(7).value = {
        formula: `E${rowNumber}-F${rowNumber}`,
        result: roundCents(row.income - row.expense),
      };
    }

    for (let column = 1; column <= COLUMNS.length; column++) {
      const cell = excelRow.getCell(column);
      cell.border = {
        top: thin,
        bottom: thin,
        left: column === 1 ? thick : thin,
        right: column === COLUMNS.length ? thick : thin,
      };
      if (column >= 3 && column <= 4) cell.alignment = { vertical: "middle", shrinkToFit: true };
      if (column >= 5) {
        cell.numFmt = EURO;
        cell.alignment = { vertical: "middle", horizontal: "right" };
        // Ein fehlender Betrag soll auffallen: Ohne ihn stimmt der Gewinn nicht.
        if (cell.value === null) cell.fill = solid(PRIMARY_SOFT);
      }
    }
    excelRow.getCell(7).font = { bold: true };
  });

  if (rows.length === 0) return;

  const lastRow = FIRST_DATA_ROW + rows.length - 1;
  const sumRow = lastRow + 1;
  sheet.getRow(sumRow).height = 22;

  const label = sheet.getCell(sumRow, 1);
  label.value = "Summe";
  label.font = { bold: true, color: { argb: "FFFFFFFF" } };
  label.fill = solid(PRIMARY);
  label.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  label.border = { top: thick, bottom: thick, left: thick, right: thin };
  sheet.mergeCells(sumRow, 1, sumRow, 4);

  const sum = (values: (number | null)[]) =>
    roundCents(values.reduce<number>((total, value) => total + (value ?? 0), 0));
  const profits = rows.map((row) =>
    row.income !== null && row.expense !== null ? row.income - row.expense : null
  );
  const totals = [
    sum(rows.map((row) => row.income)),
    sum(rows.map((row) => row.expense)),
    sum(profits),
  ];

  ["E", "F", "G"].forEach((column, index) => {
    const cell = sheet.getCell(`${column}${sumRow}`);
    cell.value = {
      formula: `SUM(${column}${FIRST_DATA_ROW}:${column}${lastRow})`,
      result: totals[index],
    };
    cell.numFmt = EURO;
    cell.font = { bold: true, color: { argb: PRIMARY } };
    cell.fill = solid(PRIMARY_SOFT);
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.border = { top: thick, bottom: thick, left: thin, right: column === "G" ? thick : thin };
  });
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

  try {
    const [orders, invoiceItems] = await Promise.all([
      fetchAll<OrderRow>((from, to) =>
        adminClient
          .from("external_orders")
          .select(
            "id, order_nr, loading_date, unloading_date, completed_at, client_company, loading_company, " +
              "recipient_company, freight_rate, deadline_surcharge, customer_price",
          )
          .eq("status", "completed")
          .order("id")
          .range(from, to)
      ),
      fetchAll<InvoiceItemRow>((from, to) =>
        adminClient
          .from("invoice_items")
          .select("external_order_id, preis")
          .not("external_order_id", "is", null)
          .order("external_order_id")
          .range(from, to)
      ),
    ]);

    // Der Preis der Rechnung gilt vor dem am Auftrag: Dort hat ihn der Chef
    // zuletzt bearbeitet.
    const invoicePrices = new Map<string, number>();
    for (const item of invoiceItems) {
      const price = toNumberOrNull(item.preis);
      if (price !== null) invoicePrices.set(item.external_order_id, price);
    }

    const months = buildMonths(orders, invoicePrices);

    // Eine Mappe ohne Arbeitsblatt ist keine gültige xlsx-Datei.
    if (months.size === 0) months.set(toViennaIsoDate(new Date()).slice(0, 7), []);

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    for (const key of [...months.keys()].sort()) {
      addMonthSheet(workbook, key, months.get(key) ?? []);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Gewinnliste_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        // octet-stream statt xlsx-Typ, siehe export-tank-entries: nur so
        // liefert supabase-js einen Blob statt kaputtem Text.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (exportError) {
    return internalError("export-external-profit", exportError);
  }
});
