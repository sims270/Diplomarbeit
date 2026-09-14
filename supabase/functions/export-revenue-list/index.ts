// Supabase Edge Function: export-revenue-list
//
// Baut die Umsatzliste des Chefs als .xlsx-Datei — bisher von Hand
// geschrieben. Aufbau wie seine bisherige Datei, alles auf einem Blatt:
// je LKW ein Block nebeneinander, oben das Kennzeichen, darunter Fahrt für
// Fahrt Datum, Frachtkilometer, Leerkilometer, Preis und Richtung. In der
// gelben Spalte rechts daneben die Beträge der Beilader.
//
// Woher die Werte kommen:
//   Datum          Ladedatum des Auftrags (sonst Entladedatum, sonst der
//                  Tag, an dem der Fahrer ihn erledigt hat)
//   Kilometer      vom Fahrer beim Erledigen (20260914100000)
//   Preis          aus der Rechnung, die der Chef zum Auftrag bearbeitet
//   Richtung       trägt der Chef in der Umsatzliste der App nach
//   LKW            beim Erledigen festgehaltenes Kennzeichen (20260914120000)
//
// Warum Edge Function: dieselbe Begründung wie bei export-tank-entries —
// die Web-App ist statisch gebaut, und exceljs ist keine Abhängigkeit der
// App.
//
// Deploy: supabase functions deploy export-revenue-list

import ExcelJS from "npm:exceljs@4.4.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

interface OrderRow {
  id: string;
  order_nr: string;
  cargo_type: string | null;
  empty_km: number | null;
  freight_km: number | null;
  loading_date: string | null;
  unloading_date: string | null;
  completed_at: string | null;
  direction: string | null;
  license_plate: string | null;
}

interface InvoiceRow {
  order_id: string;
  preis: string | number | null;
}

interface PlateRow {
  name: string;
  retired_at: string | null;
}

interface Trip {
  orderNr: string;
  date: string | null;
  freightKm: number | null;
  emptyKm: number | null;
  price: number | null;
  direction: string;
}

interface TruckBlock {
  name: string;
  komplett: Trip[];
  beilader: Trip[];
}

const NO_TRUCK = "Ohne LKW";

// Spalten je LKW-Block, in der Reihenfolge der bisherigen Datei.
const BLOCK_WIDTH = 6;
const COLUMN_WIDTHS = [12, 9, 9, 11, 10, 11];
const HEADERS = ["Datum", "km", "Leer-km", "Preis", "Richtung", "Beilader"];

// Wie license_plate_key in tank_entries: "GR 400 FX" und "gr400fx" sind
// derselbe LKW.
function plateKey(plate: string): string {
  return plate.replace(/\s+/g, "").toUpperCase();
}

// numeric kommt aus PostgREST als String — als Text in die Zelle
// geschrieben wäre die Spalte in Excel nicht summierbar.
function toNumberOrNull(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// completed_at ist ein UTC-Zeitstempel. Der Tag, den der Fahrer erlebt hat,
// ist der in Österreich — abends läge ein slice(0, 10) einen Tag daneben.
function toViennaIsoDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(timestamp),
  );
}

function tripDate(order: OrderRow): string | null {
  if (order.loading_date) return order.loading_date;
  if (order.unloading_date) return order.unloading_date;
  return order.completed_at ? toViennaIsoDate(order.completed_at) : null;
}

// Siehe export-tank-entries: mittags verankert, damit das Datum beim
// Umrechnen in die Excel-Serienzahl nicht auf den Vortag kippt.
function toExcelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toGermanDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

// Ohne Datum ans Ende, sonst chronologisch.
function byDate(a: Trip, b: Trip): number {
  if (a.date === b.date) return a.orderNr.localeCompare(b.orderNr, "de", { numeric: true });
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date.localeCompare(b.date);
}

/**
 * Ein Block je LKW. Reihenfolge wie in der LKW-Verwaltung (nach dem
 * Eintragen), damit die Blöcke bei jedem Export an derselben Stelle stehen
 * — der Chef findet "seinen" LKW dann immer in denselben Spalten.
 *
 * Aktive LKW bekommen ihren Block auch ohne Fahrt; ausgeflottete nur, wenn
 * es Fahrten mit ihnen gibt. Kennzeichen, die nicht in der Flotte stehen,
 * folgen alphabetisch, Aufträge ganz ohne LKW zuletzt.
 */
function buildBlocks(
  orders: OrderRow[],
  prices: Map<string, number | null>,
  plates: PlateRow[],
): TruckBlock[] {
  const blocks = new Map<string, TruckBlock>();

  for (const plate of plates) {
    const key = plateKey(plate.name);
    if (!plate.retired_at && !blocks.has(key)) {
      blocks.set(key, { name: plate.name, komplett: [], beilader: [] });
    }
  }

  const fleetNames = new Map(plates.map((p) => [plateKey(p.name), p.name]));
  const extra = new Map<string, TruckBlock>();

  for (const order of orders) {
    const raw = order.license_plate?.trim() ?? "";
    const key = raw ? plateKey(raw) : NO_TRUCK;

    let block = blocks.get(key) ?? extra.get(key);
    if (!block) {
      block = { name: raw ? (fleetNames.get(key) ?? raw) : NO_TRUCK, komplett: [], beilader: [] };
      // Ausgeflottete LKW mit Fahrten stehen bei der Flotte, nicht hinten.
      if (fleetNames.has(key)) blocks.set(key, block);
      else extra.set(key, block);
    }

    const trip: Trip = {
      orderNr: order.order_nr,
      date: tripDate(order),
      freightKm: order.freight_km,
      emptyKm: order.empty_km,
      price: prices.get(order.id) ?? null,
      direction: order.direction?.trim() ?? "",
    };

    if (order.cargo_type === "beilader") block.beilader.push(trip);
    else block.komplett.push(trip);
  }

  // Ausgeflottete LKW, die erst über ihre Fahrten dazukamen, an die Stelle
  // aus der Flottenliste rücken.
  const fleetOrder = new Map(plates.map((p, index) => [plateKey(p.name), index]));
  const fleetBlocks = [...blocks.entries()]
    .sort(([a], [b]) => (fleetOrder.get(a) ?? 0) - (fleetOrder.get(b) ?? 0))
    .map(([, block]) => block);

  const extraBlocks = [...extra.entries()]
    .sort(([a], [b]) => (a === NO_TRUCK ? 1 : b === NO_TRUCK ? -1 : a.localeCompare(b)))
    .map(([, block]) => block);

  const all = [...fleetBlocks, ...extraBlocks];
  for (const block of all) {
    block.komplett.sort(byDate);
    block.beilader.sort(byDate);
  }
  return all;
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

  const [ordersResult, invoicesResult, platesResult] = await Promise.all([
    adminClient
      .from("orders")
      .select(
        "id, order_nr, cargo_type, empty_km, freight_km, loading_date, unloading_date, completed_at, direction, license_plate",
      )
      .eq("status", "completed"),
    adminClient.from("invoice_items").select("order_id, preis"),
    adminClient
      .from("license_plates")
      .select("name, retired_at")
      .order("created_at", { ascending: true }),
  ]);

  const queryError = ordersResult.error ?? invoicesResult.error ?? platesResult.error;
  if (queryError) {
    return json({ error: queryError.message }, 400);
  }

  const prices = new Map(
    ((invoicesResult.data ?? []) as InvoiceRow[]).map((row) => [
      row.order_id,
      toNumberOrNull(row.preis),
    ]),
  );

  const blocks = buildBlocks(
    (ordersResult.data ?? []) as OrderRow[],
    prices,
    (platesResult.data ?? []) as PlateRow[],
  );

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Umsatzliste");

  const yellow: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFF00" },
  };

  blocks.forEach((block, index) => {
    // Spaltennummern in ExcelJS beginnen bei 1.
    const first = index * BLOCK_WIDTH + 1;
    const col = (offset: number) => first + offset;

    COLUMN_WIDTHS.forEach((width, offset) => {
      sheet.getColumn(col(offset)).width = width;
    });

    const title = sheet.getCell(1, col(0));
    title.value = block.name;
    title.font = { bold: true };

    HEADERS.forEach((header, offset) => {
      const cell = sheet.getCell(2, col(offset));
      cell.value = header;
      cell.font = { italic: true, size: 9, color: { argb: "FF7F7F7F" } };
    });

    block.komplett.forEach((trip, i) => {
      const row = 3 + i;
      if (trip.date) {
        const cell = sheet.getCell(row, col(0));
        cell.value = toExcelDate(trip.date);
        cell.numFmt = "dd.mm.yyyy";
      }
      sheet.getCell(row, col(1)).value = trip.freightKm;
      sheet.getCell(row, col(2)).value = trip.emptyKm;
      const price = sheet.getCell(row, col(3));
      price.value = trip.price;
      price.numFmt = "#,##0.00";
      sheet.getCell(row, col(4)).value = trip.direction || null;
    });

    // Gelb wie in der bisherigen Datei, auch in leeren Zellen neben den
    // Fahrten — so ist die Beilader-Spalte als solche erkennbar, auch wenn
    // es noch keinen Beilader gab.
    const yellowRows = Math.max(block.komplett.length, block.beilader.length, 1);
    for (let i = 0; i < yellowRows; i++) {
      sheet.getCell(3 + i, col(5)).fill = yellow;
    }

    block.beilader.forEach((trip, i) => {
      const cell = sheet.getCell(3 + i, col(5));
      cell.value = trip.price;
      cell.numFmt = "#,##0.00";
      // Zum Beilader steht in der Liste nur der Betrag. Welcher Auftrag
      // dahintersteht, zeigt die Notiz beim Darüberfahren mit der Maus.
      cell.note = [`Auftrag ${trip.orderNr}`, trip.date ? toGermanDate(trip.date) : null]
        .filter(Boolean)
        .join(" · ");
    });
  });

  // Kennzeichen und Spaltenköpfe beim Scrollen stehen lassen.
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Umsatzliste_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      ...corsHeaders,
      // octet-stream statt xlsx-Typ, siehe export-tank-entries: nur so
      // liefert supabase-js einen Blob statt kaputtem Text.
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
