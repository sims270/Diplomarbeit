import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

/**
 * Tankvorgänge, die ein Fahrer in der App erfasst — der digitale Ersatz
 * für den Papierzettel "Tankliste" im LKW.
 *
 * Wer welche Einträge sieht, entscheidet RLS in
 * supabase/migrations/20260909100000_create_tank_entries.sql: der Fahrer
 * nur seine eigenen, der Chef alle. Die Abfragen hier filtern zusätzlich
 * explizit — nicht weil RLS das nicht könnte, sondern damit an der
 * Aufrufstelle lesbar bleibt, welche Daten gemeint sind.
 */
export interface TankEntry {
  id: string;
  /** ISO 'YYYY-MM-DD', wie überall im Projekt (siehe lib/dateFormat.ts) */
  entryDate: string;
  licensePlate: string;
  kmStand: number;
  litersDiesel: number;
  /** null = bei diesem Tankvorgang kein AdBlue nachgefüllt */
  litersAdBlue: number | null;
  fuelStation: string;
  createdAt: string;
}

export interface NewTankEntry {
  entryDate: string;
  licensePlate: string;
  kmStand: number;
  litersDiesel: number;
  litersAdBlue: number | null;
  fuelStation: string;
}

interface TankEntryRow {
  id: string;
  entry_date: string;
  license_plate: string;
  km_stand: number;
  liters_diesel: string | number;
  liters_adblue: string | number | null;
  fuel_station: string;
  created_at: string;
}

// numeric kommt aus PostgREST als String, damit keine Nachkommastellen
// verloren gehen. Für Anzeige und Excel brauchen wir eine echte Zahl.
function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function mapRow(row: TankEntryRow): TankEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    licensePlate: row.license_plate,
    kmStand: row.km_stand,
    litersDiesel: toNumber(row.liters_diesel),
    litersAdBlue: row.liters_adblue === null ? null : toNumber(row.liters_adblue),
    fuelStation: row.fuel_station,
    createdAt: row.created_at,
  };
}

/**
 * Literangaben, so wie Fahrer sie vom Zettel abtippen: "580,01", "650",
 * gelegentlich auch "1.119,19" aus der Excel-Schreibweise. Ein reines
 * Number() ergäbe daraus NaN.
 *
 * Das Komma entscheidet: steht eines drin, ist es das Dezimaltrennzeichen
 * und Punkte sind Tausenderpunkte. Ohne Komma wird ein Punkt als
 * Dezimalpunkt gelesen ("580.01"). Der Restfall "1.119" ohne Komma bleibt
 * mehrdeutig und wird als 1,119 gelesen — deshalb zeigt das Formular als
 * Platzhalter bewusst die Komma-Schreibweise.
 */
export function parseGermanNumber(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  // Number('') ist 0 und Number('12abc') ist NaN — der erste Fall ist oben
  // schon abgefangen, der zweite landet hier.
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

/**
 * Der km-Stand ist immer eine ganze Zahl, deshalb kann ein Punkt darin nur
 * ein Tausenderpunkt sein — genau so steht er auch auf dem Zettel
 * ("34.389"). Hier ist das Wegstreichen also eindeutig und nicht geraten.
 */
export function parseOdometer(input: string): number | null {
  const cleaned = input.trim().replace(/[\s.]/g, '');
  if (!cleaned || !/^\d+$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function getTankEntriesByDriver(driverId: string): Promise<TankEntry[]> {
  const { data, error } = await supabase
    .from('tank_entries')
    .select('*')
    .eq('driver_id', driverId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapRow);
}

export async function createTankEntry(input: NewTankEntry): Promise<TankEntry> {
  const { data: userData } = await supabase.auth.getUser();
  const driverId = userData.user?.id;

  if (!driverId) {
    throw new Error('Nicht angemeldet — bitte neu einloggen.');
  }

  const { data, error } = await supabase
    .from('tank_entries')
    .insert({
      // Die Spalte hat zwar default auth.uid(), aber explizit gesetzt ist
      // es das, was die RLS-with-check-Policy prüft — und damit die
      // Stelle, an der ein fremder Fahrer abgewiesen würde.
      driver_id: driverId,
      entry_date: input.entryDate,
      license_plate: input.licensePlate.trim(),
      km_stand: input.kmStand,
      liters_diesel: input.litersDiesel,
      liters_adblue: input.litersAdBlue,
      fuel_station: input.fuelStation.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return mapRow(data);
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * supabase-js meldet Fehler aus Edge Functions in zwei Geschmacksrichtungen,
 * und die Rohtexte beider sind für den Chef im Dashboard wertlos:
 *
 * - FunctionsHttpError: die Function hat geantwortet, aber mit 4xx/5xx.
 *   Die eigentliche Begründung steht in ihrem JSON-Body (z. B. "Only a boss
 *   account can do this"), nicht in error.message — das sagt nur
 *   "non-2xx status code".
 * - FunctionsFetchError ("Failed to send a request to the Edge Function"):
 *   die Anfrage kam gar nicht erst an. In der Praxis heißt das fast immer,
 *   dass die Function noch nicht deployt ist — die Antwort des Gateways
 *   trägt dann keine CORS-Header, und der Browser verwirft sie, bevor
 *   supabase-js den Status überhaupt sieht.
 */
async function describeFunctionError(error: { name?: string; message?: string }): Promise<string> {
  const response = (error as { context?: unknown }).context;

  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (body?.error) return String(body.error);
    } catch {
      // Kein JSON-Body — dann bleibt es bei den Hinweisen unten.
    }
  }

  if (error.name === 'FunctionsFetchError') {
    return (
      'Die Edge Function "export-tank-entries" ist nicht erreichbar. ' +
      'Sie muss einmalig deployt werden:\n\n' +
      'supabase functions deploy export-tank-entries'
    );
  }

  return error.message ?? 'Export fehlgeschlagen.';
}

/**
 * Lädt die Tankliste aller Fahrer als Excel-Datei herunter — ein
 * Arbeitsblatt je Kennzeichen. Gebaut wird die Datei serverseitig in der
 * Edge Function export-tank-entries; die prüft auch, dass wirklich ein
 * Chef-Account fragt.
 *
 * Nur für Web: das Chef-Dashboard läuft im Browser (Vercel). Nativ gäbe es
 * keinen Ort, an den ein Browser-Download gehen könnte, deshalb hier ein
 * klarer Hinweis statt eines Buttons, der nichts tut.
 */
export async function downloadTankEntriesXlsx(): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Der Excel-Export steht im Web-Dashboard zur Verfügung. Bitte dort herunterladen.'
    );
  }

  const { data, error } = await supabase.functions.invoke('export-tank-entries', {
    method: 'POST',
  });

  if (error) {
    throw new Error(await describeFunctionError(error));
  }

  // Die Function antwortet als octet-stream, supabase-js liefert daraus
  // einen Blob. Kommt stattdessen ein JSON-Objekt an, war es eine
  // Fehlerantwort (z. B. 403 für einen Nicht-Chef).
  if (!(data instanceof Blob)) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Unerwartete Antwort vom Server.';
    throw new Error(message);
  }

  // Der Blob trägt den generischen octet-stream-Typ; erst mit dem echten
  // xlsx-Typ schlägt Windows die Datei von sich aus in Excel auf.
  const url = URL.createObjectURL(data.slice(0, data.size, XLSX_MIME));
  const fileName = `Tankliste_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // Bewusst ein <a download> statt location.href wie in lib/download.ts:
  // dort geht es um eine signierte URL, deren Content-Disposition der
  // Server setzt. Ein Blob aus dem Speicher hat keine solche Antwort, der
  // Dateiname muss also hier vergeben werden.
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Ohne revoke bleibt der Blob bis zum Neuladen der Seite im Speicher.
  // Erst im nächsten Tick: Safari bricht den gerade gestarteten Download
  // ab, wenn die URL noch im selben Durchlauf freigegeben wird.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
