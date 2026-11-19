// Supabase Edge Function: export-external-profit
//
// Baut die Gewinnliste als .xlsx-Datei — die "Auftragsaufzeichnungen" des
// Chefs: je Monat ein Blatt, je erledigtem Fremdauftrag eine Zeile mit
// Eingang, Ausgang und Gewinn. Schrift und Farben wie in der Tankliste
// (export-tank-entries).
//
// Woher die Werte kommen:
//   Auftragsdatum  Ladedatum (sonst Entladedatum, sonst Tag des Erledigens)
//   von Firma      Auftraggeber, ohne Eintrag die Ladestelle
//   an Spedition   der Frachtführer des Fremdauftrags
//   Eingang        Preis aus der Rechnung samt Dieselzuschlag, sonst der
//                  Kundenpreis am Auftrag
//   Ausgang        Frachtsatz plus Terminzuschlag
//
// Deploy: supabase functions deploy export-external-profit

import ExcelJS from "npm:exceljs@4.4.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

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
  /** Dieselzuschlag in Prozent vom Preis (20261119210000_invoice_item_extras.sql). */
  diesel_prozent: string | number | null;
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
          .select("external_order_id, preis, diesel_prozent")
          .not("external_order_id", "is", null)
          .order("external_order_id")
          .range(from, to)
      ),
    ]);

    // Der Preis der Rechnung gilt vor dem am Auftrag: Dort hat ihn der Chef
    // zuletzt bearbeitet. Der Dieselzuschlag ist Einnahme wie der Preis und
    // zählt zum Gewinn — gleich gerechnet wie auf der Rechnung
    // (export-invoice: Preis mal Prozent, auf Cent gerundet).
    const invoicePrices = new Map<string, number>();
    for (const item of invoiceItems) {
      const price = toNumberOrNull(item.preis);
      if (price === null) continue;
      const prozent = toNumberOrNull(item.diesel_prozent);
      const diesel = prozent ? roundCents((price * prozent) / 100) : 0;
      invoicePrices.set(item.external_order_id, roundCents(price + diesel));
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
