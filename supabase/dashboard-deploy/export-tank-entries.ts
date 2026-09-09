// ============================================================================
// export-tank-entries — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/export-tank-entries/index.ts —
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

// --- die eigentliche Function ----------------------------------------------
interface TankEntryRow {
  entry_date: string;
  license_plate: string;
  license_plate_key: string;
  km_stand: number;
  liters_diesel: string | number;
  liters_adblue: string | number | null;
  fuel_station: string;
}

// numeric kommt aus PostgREST als String — als Text in die Zelle
// geschrieben wäre die Spalte in Excel nicht summierbar.
function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

interface SheetGroup {
  year: number;
  /** 1–12 */
  month: number;
  plateKey: string;
  entries: TankEntryRow[];
}

/**
 * Ein Arbeitsblatt je Kennzeichen und Monat — dieselbe Aufteilung, die die
 * bisherige Excel-Datei des Chefs von Hand hatte ("Juni_LNTSHO1",
 * "Juli_GR400FX").
 *
 * Die Zeilen kommen bereits nach Kennzeichen und Datum sortiert aus der
 * Datenbank; da Map die Einfügereihenfolge erhält, stehen die Einträge
 * innerhalb eines Blatts damit automatisch chronologisch. Sortiert wird
 * hier nur noch die Reihenfolge der Blätter selbst.
 */
function groupByMonthAndPlate(rows: TankEntryRow[]): SheetGroup[] {
  const groups = new Map<string, SheetGroup>();

  for (const row of rows) {
    const [year, month] = row.entry_date.split("-").map(Number);
    const plateKey = row.license_plate_key || row.license_plate;
    const key = `${year}-${month}-${plateKey}`;

    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(row);
    } else {
      groups.set(key, { year, month, plateKey, entries: [row] });
    }
  }

  // Chronologisch, innerhalb eines Monats alphabetisch nach Kennzeichen.
  return [...groups.values()].sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.plateKey.localeCompare(b.plateKey),
  );
}

/**
 * Excel verbietet in Blattnamen : \ / ? * [ ] und begrenzt sie auf 31
 * Zeichen. Das Kennzeichen reißt das normalerweise nicht, aber der Wert
 * kommt aus einem Freitextfeld — ungeprüft würde ein einziger Schrägstrich
 * die ganze Datei unlesbar machen.
 */
function sanitizeSheetName(raw: string): string {
  const cleaned = raw.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
  return cleaned || "Tankliste";
}

/**
 * Bevorzugt "Juli_GR400FX", genau wie in der bisherigen Datei. Der Jahres-
 * zusatz greift nur, wenn derselbe Monatsname mit demselben Kennzeichen in
 * zwei Jahren vorkommt: Excel lässt zwei gleichnamige Blätter nicht zu, und
 * der Export enthält alle je erfassten Tankvorgänge — ohne diesen Ausweg
 * wäre die Datei ab dem dreizehnten Monat nicht mehr erzeugbar.
 */
function toSheetName(group: SheetGroup, taken: Set<string>): string {
  const month = MONTH_NAMES[group.month - 1];

  // Nur der Platzhalter für "noch keine Tankvorgänge" hat keinen Monat.
  if (!month) {
    const name = sanitizeSheetName(group.plateKey);
    taken.add(name);
    return name;
  }

  const candidates = [
    `${month}_${group.plateKey}`,
    `${month} ${group.year}_${group.plateKey}`,
  ];

  for (const candidate of candidates) {
    const name = sanitizeSheetName(candidate);
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }

  // Nur noch erreichbar, wenn das Kürzen auf 31 Zeichen zwei Namen
  // gleichgemacht hat.
  let suffix = 2;
  let name = sanitizeSheetName(`${candidates[1]} (${suffix})`);
  while (taken.has(name)) {
    suffix += 1;
    name = sanitizeSheetName(`${candidates[1]} (${suffix})`);
  }
  taken.add(name);
  return name;
}

/**
 * Wie viele Tage der Monat hat. Tag 0 des Folgemonats ist der letzte Tag
 * des gesuchten — damit stimmen Februar und Schaltjahre ohne Sonderfall.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * ExcelJS rechnet ein JS-Date über UTC in die Excel-Serienzahl um. Ein aus
 * 'YYYY-MM-DD' gebautes Date liegt auf UTC-Mitternacht und kippt dabei je
 * nach Zeitzone auf den Vortag. Mittags verankert übersteht das Datum jede
 * Verschiebung, ohne dass die Zelle ihren echten Datumstyp verliert.
 */
function toExcelDate(isoDate: string): Date | string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d, 12));
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

  const { data, error: queryError } = await adminClient
    .from("tank_entries")
    .select(
      "entry_date, license_plate, license_plate_key, km_stand, liters_diesel, liters_adblue, fuel_station",
    )
    .order("license_plate_key", { ascending: true })
    .order("entry_date", { ascending: true });

  if (queryError) {
    return json({ error: queryError.message }, 400);
  }

  const rows = (data ?? []) as TankEntryRow[];

  // Gruppiert wird über den normalisierten Schlüssel, damit "GR400FX" und
  // "gr 400 fx" auf demselben Blatt landen.
  const groups = groupByMonthAndPlate(rows);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // Eine Mappe ohne Arbeitsblatt ist keine gültige xlsx-Datei — solange
  // noch niemand getankt hat, braucht es trotzdem eines.
  if (groups.length === 0) {
    groups.push({ year: 0, month: 0, plateKey: "Tankliste", entries: [] });
  }

  const takenSheetNames = new Set<string>();

  for (const group of groups) {
    const sheet = workbook.addWorksheet(toSheetName(group, takenSheetNames));
    const entries = group.entries;

    // Preis/Liter und Preis ges. sind bewusst nur Überschriften: die Preise
    // stehen nicht auf dem Zettel des Fahrers, liegen also auch nicht in
    // der Datenbank. Beide Spalten bleiben leer, der Chef trägt sie wie
    // bisher von Hand nach — auch die Gesamtsumme, hier steht bewusst
    // keine Formel.
    sheet.columns = [
      { header: "Datum", key: "date", width: 14 },
      { header: "km-Stand", key: "km", width: 14 },
      { header: "Liter Diesel", key: "diesel", width: 14 },
      { header: "Liter AdBlue", key: "adblue", width: 14 },
      { header: "Tankstelle/Ort", key: "station", width: 32 },
      { header: "Preis/Liter", key: "pricePerLiter", width: 14 },
      { header: "Preis ges.", key: "priceTotal", width: 16 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      // RAL 3002 (#9b2321) — die Primärfarbe der App.
      fgColor: { argb: "FF9B2321" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Die Tankvorgänge nach Tag im Monat vorsortieren.
    const byDay = new Map<number, TankEntryRow[]>();
    for (const entry of entries) {
      const day = Number(entry.entry_date.split("-")[2]);
      const existing = byDay.get(day);
      if (existing) {
        existing.push(entry);
      } else {
        byDay.set(day, [entry]);
      }
    }

    // Der Monat steht durchgehend im Blatt — jeder Tag von 1 bis 30/31
    // bekommt eine Zeile, auch wenn nicht getankt wurde. Genau so sah das
    // bisherige Blatt des Chefs aus: ein Kalender, in dem nur an Tanktagen
    // etwas steht. (group.month ist 0 beim Platzhalterblatt für "noch
    // keine Tankvorgänge" — das bleibt leer.)
    if (group.month >= 1) {
      const lastDay = daysInMonth(group.year, group.month);

      for (let day = 1; day <= lastDay; day++) {
        const isoDate = toIsoDate(group.year, group.month, day);
        const dayEntries = byDay.get(day) ?? [];

        if (dayEntries.length === 0) {
          // Tag ohne Tankvorgang: nur das Datum, alle anderen Zellen leer.
          sheet.addRow({ date: toExcelDate(isoDate) });
          continue;
        }

        // Wurde an einem Tag mehrfach getankt, bekommt jeder Vorgang seine
        // eigene Zeile unter demselben Datum — sonst ginge einer verloren.
        for (const entry of dayEntries) {
          sheet.addRow({
            date: toExcelDate(isoDate),
            km: entry.km_stand,
            diesel: toNumber(entry.liters_diesel),
            // Leer lassen statt 0 — auf dem Zettel steht dort ein Strich,
            // wenn nichts nachgefüllt wurde.
            adblue: entry.liters_adblue === null ? null : toNumber(entry.liters_adblue),
            station: entry.fuel_station,
            // pricePerLiter und priceTotal werden nicht gesetzt: die Zellen
            // bleiben leer, damit der Chef sie selbst befüllt.
          });
        }
      }
    }

    sheet.getColumn("date").numFmt = "dd.mm.yyyy";
    sheet.getColumn("km").numFmt = "#,##0";
    sheet.getColumn("diesel").numFmt = "#,##0.00";
    sheet.getColumn("adblue").numFmt = "#,##0.00";
    // Vier Nachkommastellen, weil Literpreise so notiert werden (1,3775).
    sheet.getColumn("pricePerLiter").numFmt = "#,##0.0000";
    sheet.getColumn("priceTotal").numFmt = '"EUR" #,##0.00';

    // Kopfzeile beim Scrollen stehen lassen — die Blätter werden mit der
    // Zeit lang.
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Tankliste_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      ...corsHeaders,
      // Bewusst octet-stream statt des exakten xlsx-Typs: supabase-js
      // entscheidet in functions.invoke anhand des Content-Type, wie es den
      // Body liest, und kennt dabei nur json, octet-stream,
      // text/event-stream und multipart/form-data. Alles andere — der
      // xlsx-Typ eingeschlossen — landet im text()-Zweig, und der macht aus
      // der Binärdatei unbrauchbaren UTF-8-Text. Mit octet-stream kommt ein
      // echter Blob an, dem der Client beim Speichern den richtigen
      // xlsx-Typ gibt (siehe app/services/tankEntryService.ts).
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
