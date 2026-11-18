// ============================================================================
// export-weekly-revenue — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/export-weekly-revenue/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts, _shared/email.ts und
// _shared/verify-boss.ts stehen hier inline. Der Dashboard-Editor legt die
// eingefuegte Datei allein unter /tmp/.../source/index.ts ab, relative Imports
// laufen dort ins Leere.
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

// --- aus _shared/email.ts ---------------------------------------------------
function emailToUsername(email: string): string {
  return email.split("@")[0];
}

// --- die eigentliche Function ----------------------------------------------
interface OrderRow {
  id: string;
  order_nr: string;
  assigned_to: string | null;
  loading_date: string | null;
  unloading_date: string | null;
  completed_at: string | null;
  loading_time_from: string | null;
  loading_company: string | null;
  loading_address: string | null;
  unloading_company: string | null;
  unloading_address: string | null;
  license_plate: string | null;
}

interface PriceRow {
  order_id: string;
  preis: string | number | null;
}

interface PlateRow {
  name: string;
  retired_at: string | null;
}

interface Driver {
  name: string;
  plate: string;
}

interface Stop {
  orderNr: string;
  time: string;
  from: string;
  to: string;
  price: number | null;
}

interface Truck {
  name: string;
  drivers: Set<string>;
  /** Index 0 = Montag, 6 = Sonntag. */
  days: Stop[][];
}

interface Week {
  year: number;
  number: number;
  monday: string;
  trucks: Map<string, Truck>;
}

const NO_TRUCK = "Ohne LKW";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

// Je Tag zwei Spalten: Ladeort links, Entladeort rechts.
const DAY_COUNT = 7;
const PLATE_COLUMN = DAY_COUNT * 2 + 1;
// So hoch wie in der bisherigen Liste, auch an Tagen mit wenigen Fahrten.
const MIN_STOP_ROWS = 3;

const PRIMARY = "FF9B2321";
const PRIMARY_SOFT = "FFF6DEDD";
const GRAY = "FFF2F2F2";
const EURO = '"€" #,##0.00';

const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const thick = { style: "medium" as const, color: { argb: PRIMARY } };

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// Wie license_plate_key in tank_entries: "GR 400 FX" und "gr400fx" sind
// derselbe LKW.
function plateKey(plate: string): string {
  return plate.replace(/\s+/g, "").toUpperCase();
}

// numeric kommt aus PostgREST als String.
function toNumberOrNull(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function toViennaIsoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(date);
}

function orderDate(order: OrderRow): string | null {
  if (order.loading_date) return order.loading_date;
  if (order.unloading_date) return order.unloading_date;
  return order.completed_at ? toViennaIsoDate(new Date(order.completed_at)) : null;
}

function isoDatePlusDays(isoDate: string, days: number): string {
  const time = new Date(`${isoDate}T12:00:00Z`).getTime() + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

/** Kalenderwoche nach ISO 8601: Sie gehört zu dem Jahr, in dem ihr Donnerstag liegt. */
function weekOf(isoDate: string): { year: number; number: number; monday: string; weekday: number } {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  const monday = isoDatePlusDays(isoDate, -weekday);
  const thursday = new Date(`${isoDatePlusDays(monday, 3)}T12:00:00Z`);
  const year = thursday.getUTCFullYear();
  const dayOfYear = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS);
  return { year, number: Math.floor(dayOfYear / 7) + 1, monday, weekday };
}

/**
 * Nur der Ort, wie in der bisherigen Liste: "Hauptstraße 1, A-8700 Leoben"
 * wird zu "Leoben". Ohne erkennbare Adresse bleibt der Firmenname.
 */
function placeName(address: string | null, company: string | null): string {
  const trimmed = (address ?? "").trim();
  const afterComma = trimmed.slice(trimmed.lastIndexOf(",") + 1).trim();
  const town = afterComma.match(/\b\d{4,5}\s+(.+)$/)?.[1] ?? afterComma;
  return town.trim() || (company ?? "").trim();
}

function dayHeader(isoDate: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

// PostgREST liefert höchstens 1000 Zeilen je Abfrage — ohne Blättern fehlten
// bei älteren Datenbeständen stillschweigend Fahrten und Preise.
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

function newTruck(name: string): Truck {
  return { name, drivers: new Set(), days: Array.from({ length: DAY_COUNT }, () => []) };
}

function buildWeeks(
  orders: OrderRow[],
  prices: Map<string, number | null>,
  drivers: Map<string, Driver>,
  today: string,
): Week[] {
  const weeks = new Map<string, Week>();

  const weekFor = (isoDate: string): Week => {
    const { year, number, monday } = weekOf(isoDate);
    let week = weeks.get(monday);
    if (!week) {
      week = { year, number, monday, trucks: new Map() };
      weeks.set(monday, week);
    }
    return week;
  };

  // Die laufende Woche gibt es immer, auch bevor etwas disponiert ist.
  weekFor(today);

  for (const order of orders) {
    // Ohne jedes Datum lässt sich die Fahrt keinem Tag zuordnen.
    const date = orderDate(order);
    if (!date) continue;

    const driver = order.assigned_to ? drivers.get(order.assigned_to) : undefined;
    const plate = order.license_plate?.trim() || driver?.plate || "";
    const key = plate ? plateKey(plate) : NO_TRUCK;

    const week = weekFor(date);
    let truck = week.trucks.get(key);
    if (!truck) {
      truck = newTruck(plate || NO_TRUCK);
      week.trucks.set(key, truck);
    }

    if (driver?.name) truck.drivers.add(driver.name);
    truck.days[weekOf(date).weekday].push({
      orderNr: order.order_nr,
      time: order.loading_time_from ?? "",
      from: placeName(order.loading_address, order.loading_company),
      to: placeName(order.unloading_address, order.unloading_company),
      price: prices.get(order.id) ?? null,
    });
  }

  return [...weeks.values()].sort((a, b) => a.monday.localeCompare(b.monday));
}

/**
 * Die Blöcke einer Woche. Aktive LKW stehen immer in derselben Reihenfolge
 * wie in der LKW-Verwaltung, auch ohne Fahrt. Ausgeflottete LKW und
 * Kennzeichen außerhalb der Flotte kommen nur mit Fahrten dazu.
 */
function trucksOfWeek(week: Week, plates: PlateRow[], drivers: Driver[]): Truck[] {
  const result: Truck[] = [];
  const used = new Set<string>();

  for (const plate of plates) {
    const key = plateKey(plate.name);
    if (used.has(key)) continue;

    const truck = week.trucks.get(key);
    if (!truck && plate.retired_at) continue;

    used.add(key);
    const entry = truck ?? newTruck(plate.name);
    entry.name = plate.name;
    if (entry.drivers.size === 0) {
      for (const driver of drivers) {
        if (driver.plate && plateKey(driver.plate) === key) entry.drivers.add(driver.name);
      }
    }
    result.push(entry);
  }

  const others = [...week.trucks.entries()]
    .filter(([key]) => !used.has(key))
    .sort(([a], [b]) => (a === NO_TRUCK ? 1 : b === NO_TRUCK ? -1 : a.localeCompare(b)))
    .map(([, truck]) => truck);

  return [...result, ...others];
}

function addHeader(sheet: ExcelJS.Worksheet, monday: string): void {
  const header = sheet.getRow(1);
  header.height = 34;

  const style = (cell: ExcelJS.Cell, value: string) => {
    cell.value = value;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solid(PRIMARY);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thick, bottom: thick, left: thin, right: thin };
  };

  for (let day = 0; day < DAY_COUNT; day++) {
    const column = day * 2 + 1;
    style(sheet.getCell(1, column), dayHeader(isoDatePlusDays(monday, day)));
    // Erst nach dem Formatieren verbinden, siehe export-tank-entries.
    sheet.mergeCells(1, column, 1, column + 1);
  }
  style(sheet.getCell(1, PLATE_COLUMN), "Kennzeichen");
}

/** Schreibt einen LKW-Block und gibt Zeile und Betrag seiner Wochensumme zurück. */
function addTruckBlock(
  sheet: ExcelJS.Worksheet,
  truck: Truck,
  firstRow: number,
): { sumRow: number; sum: number } {
  const stopRows = Math.max(MIN_STOP_ROWS, ...truck.days.map((stops) => stops.length));
  const sumRow = firstRow + stopRows;
  let weekSum = 0;

  for (let day = 0; day < DAY_COUNT; day++) {
    const fromColumn = day * 2 + 1;
    const toColumn = fromColumn + 1;
    const stops = [...truck.days[day]].sort((a, b) =>
      a.time.localeCompare(b.time) || a.orderNr.localeCompare(b.orderNr, "de", { numeric: true })
    );

    for (let line = 0; line < stopRows; line++) {
      const row = firstRow + line;
      const top = line === 0 ? thick : undefined;

      const from = sheet.getCell(row, fromColumn);
      from.value = stops[line]?.from ?? null;
      from.alignment = { vertical: "middle", horizontal: "left", shrinkToFit: true };
      from.border = { top, left: day === 0 ? thick : thin };

      const to = sheet.getCell(row, toColumn);
      to.value = stops[line]?.to ?? null;
      to.alignment = { vertical: "middle", horizontal: "right", shrinkToFit: true };
      to.border = { top, right: thin };
    }

    const known = stops.flatMap((stop) => (stop.price === null ? [] : [stop.price]));
    const daySum = known.length > 0 ? roundCents(known.reduce((a, b) => a + b, 0)) : null;
    weekSum += daySum ?? 0;

    const price = sheet.getCell(sumRow, fromColumn);
    price.value = daySum;
    price.numFmt = EURO;
    price.font = { bold: true };
    price.fill = solid(GRAY);
    price.alignment = { vertical: "middle", horizontal: "left" };
    price.border = {
      top: thin,
      bottom: thick,
      left: day === 0 ? thick : thin,
      right: thin,
    };
    sheet.mergeCells(sumRow, fromColumn, sumRow, toColumn);
  }

  for (let row = firstRow; row < sumRow; row++) {
    const cell = sheet.getCell(row, PLATE_COLUMN);
    cell.fill = solid(GRAY);
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, shrinkToFit: true };
    cell.border = { top: row === firstRow ? thick : undefined, left: thick, right: thick };
  }

  const plate = sheet.getCell(firstRow, PLATE_COLUMN);
  plate.value = truck.name;
  plate.font = { bold: true };
  sheet.getCell(firstRow + 1, PLATE_COLUMN).value = [...truck.drivers].join(", ") || null;

  const sum = roundCents(weekSum);
  const total = sheet.getCell(sumRow, PLATE_COLUMN);
  total.value = { formula: `SUM(A${sumRow}:N${sumRow})`, result: sum };
  total.numFmt = EURO;
  total.font = { bold: true, color: { argb: PRIMARY } };
  total.fill = solid(PRIMARY_SOFT);
  total.alignment = { vertical: "middle", horizontal: "right" };
  total.border = { top: thin, bottom: thick, left: thick, right: thick };

  return { sumRow, sum };
}

function addWeekSheet(workbook: ExcelJS.Workbook, week: Week, trucks: Truck[]): void {
  const sheet = workbook.addWorksheet(`KW ${week.number} ${week.year}`, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  for (let column = 1; column < PLATE_COLUMN; column++) {
    sheet.getColumn(column).width = 13;
  }
  sheet.getColumn(PLATE_COLUMN).width = 20;

  addHeader(sheet, week.monday);

  let row = 2;
  const sums: { sumRow: number; sum: number }[] = [];
  for (const truck of trucks) {
    const block = addTruckBlock(sheet, truck, row);
    sums.push(block);
    row = block.sumRow + 1;
  }

  const totalRow = row + 1;
  sheet.getRow(totalRow).height = 22;

  const label = sheet.getCell(totalRow, PLATE_COLUMN - 2);
  label.value = "LKW Ges.";
  label.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  label.fill = solid(PRIMARY);
  label.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  label.border = { top: thick, bottom: thick, left: thick, right: thick };
  sheet.mergeCells(totalRow, PLATE_COLUMN - 2, totalRow, PLATE_COLUMN - 1);

  const total = sheet.getCell(totalRow, PLATE_COLUMN);
  total.value = {
    formula: sums.length > 0 ? `SUM(${sums.map((s) => `O${s.sumRow}`).join(",")})` : "0",
    result: roundCents(sums.reduce((a, b) => a + b.sum, 0)),
  };
  total.numFmt = EURO;
  total.font = { bold: true, size: 12, color: { argb: PRIMARY } };
  total.fill = solid(PRIMARY_SOFT);
  total.alignment = { vertical: "middle", horizontal: "right" };
  total.border = { top: thick, bottom: thick, left: thick, right: thick };
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
    const [orders, invoicePrices, orderPrices, platesResult, usersResult, profilesResult] = await Promise.all([
      fetchAll<OrderRow>((from, to) =>
        adminClient
          .from("orders")
          .select(
            "id, order_nr, assigned_to, loading_date, unloading_date, completed_at, loading_time_from, " +
              "loading_company, loading_address, unloading_company, unloading_address, license_plate",
          )
          .or("assigned_to.not.is.null,status.eq.completed")
          .neq("status", "cancelled")
          .order("id")
          .range(from, to)
      ),
      fetchAll<PriceRow>((from, to) =>
        adminClient
          .from("invoice_items")
          .select("order_id, preis")
          .not("order_id", "is", null)
          .order("order_id")
          .range(from, to)
      ),
      fetchAll<PriceRow>((from, to) =>
        adminClient.from("order_prices").select("order_id, preis").order("order_id").range(from, to)
      ),
      adminClient
        .from("license_plates")
        .select("name, retired_at")
        .order("created_at", { ascending: true }),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      adminClient.from("profiles").select("id, license_plate").eq("role", "driver"),
    ]);

    if (platesResult.error) throw new Error(platesResult.error.message);
    if (usersResult.error) throw new Error(usersResult.error.message);
    if (profilesResult.error) throw new Error(profilesResult.error.message);

    // Das Kennzeichen aus public.profiles: Das user_metadata kann der Fahrer
    // selbst ändern.
    const platesByDriver = new Map<string, string>(
      (profilesResult.data ?? []).map((row) => [
        row.id as string,
        String(row.license_plate ?? "").trim(),
      ]),
    );

    // Der Preis der Rechnung gilt vor dem Preis am Auftrag: Dort hat ihn der
    // Chef zuletzt bearbeitet.
    const prices = new Map<string, number | null>();
    for (const row of orderPrices) prices.set(row.order_id, toNumberOrNull(row.preis));
    for (const row of invoicePrices) {
      const price = toNumberOrNull(row.preis);
      if (price !== null) prices.set(row.order_id, price);
    }

    const drivers = new Map<string, Driver>(
      usersResult.data.users.map((user) => [
        user.id,
        {
          name: user.email ? emailToUsername(user.email) : "",
          plate: platesByDriver.get(user.id) ?? "",
        },
      ]),
    );

    const plates = (platesResult.data ?? []) as PlateRow[];
    const weeks = buildWeeks(orders, prices, drivers, toViennaIsoDate(new Date()));

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    for (const week of weeks) {
      addWeekSheet(workbook, week, trucksOfWeek(week, plates, [...drivers.values()]));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Umsatzliste_2_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
    return internalError("export-weekly-revenue", exportError);
  }
});
