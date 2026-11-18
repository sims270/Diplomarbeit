import {
  saveToRememberedFile,
  supportsRememberedFile,
} from '@/lib/rememberedFile';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import type { CargoType } from './orderService';

/**
 * Die Umsatzliste des Chefs: je LKW jede erledigte Fahrt mit Datum,
 * Kilometern, Preis und Richtung, die Beilader-Beträge gelb daneben.
 *
 * Fast alles steht schon woanders — Kilometer am Auftrag (vom Fahrer),
 * Preis in der Rechnung (vom Chef). Neu ist nur die Richtung ("hin", "her",
 * "FR - DE"), die der Chef hier nachträgt, und das Kennzeichen, das beim
 * Erledigen am Auftrag festgehalten wird.
 * Siehe supabase/migrations/20260914120000_add_revenue_list.sql.
 */
export interface RevenueTrip {
  orderId: string;
  orderNr: string;
  cargoType: CargoType;
  /** ISO 'YYYY-MM-DD' — Ladedatum, sonst Entladedatum; leer, wenn beides fehlt. */
  date: string;
  licensePlate: string | null;
  freightKm: number | null;
  emptyKm: number | null;
  /** Aus der Rechnung; null, solange keine Rechnung oder kein Preis eingetragen ist. */
  price: number | null;
  direction: string;
}

/** Vorschläge unter dem Richtungsfeld — die häufigsten Einträge der bisherigen Liste. */
export const DIRECTION_SUGGESTIONS = ['hin', 'her', 'hin - her'];

export async function getRevenueTrips(): Promise<RevenueTrip[]> {
  const [ordersResult, invoicesResult] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_nr, cargo_type, loading_date, unloading_date, license_plate, empty_km, freight_km, direction'
      )
      .eq('status', 'completed')
      .order('loading_date', { ascending: false, nullsFirst: false }),
    supabase.from('invoice_items').select('order_id, preis'),
  ]);

  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);

  // numeric kommt aus PostgREST als String.
  const prices = new Map<string, number | null>(
    (invoicesResult.data ?? []).map((row) => [
      row.order_id as string,
      row.preis === null ? null : Number(row.preis),
    ])
  );

  return (ordersResult.data ?? []).map((row) => ({
    orderId: row.id,
    orderNr: row.order_nr,
    cargoType: (row.cargo_type as CargoType | null) ?? 'komplett',
    date: row.loading_date ?? row.unloading_date ?? '',
    licensePlate: row.license_plate ?? null,
    freightKm: row.freight_km ?? null,
    emptyKm: row.empty_km ?? null,
    price: prices.get(row.id) ?? null,
    direction: row.direction ?? '',
  }));
}

/**
 * Direkt auf orders — "Boss can edit orders" erlaubt das. Leer wird zu
 * null, damit "noch nicht eingetragen" eindeutig bleibt.
 */
export async function setOrderDirection(orderId: string, direction: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ direction: direction.trim() || null })
    .eq('id', orderId);

  if (error) throw new Error(error.message);
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Unter diesem Schlüssel merkt sich der Browser die Datei des Chefs. */
export const UMSATZLISTE_FILE_KEY = 'umsatzliste';
export const UMSATZLISTE_2_FILE_KEY = 'umsatzliste-2';
export const GEWINNLISTE_FILE_KEY = 'gewinnliste';

// Gleiche Fehlerbehandlung wie in tankEntryService.describeFunctionError:
// Die Begründung steht im JSON-Body, und ein FunctionsFetchError heißt fast
// immer "noch nicht deployt".
async function describeFunctionError(
  error: { name?: string; message?: string },
  functionName: string
): Promise<string> {
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
      `Die Edge Function "${functionName}" ist nicht erreichbar. ` +
      'Sie muss einmalig deployt werden:\n\n' +
      `supabase functions deploy ${functionName}`
    );
  }

  return error.message ?? 'Export fehlgeschlagen.';
}

async function fetchXlsx(functionName: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    method: 'POST',
  });

  if (error) {
    throw new Error(await describeFunctionError(error, functionName));
  }

  if (!(data instanceof Blob)) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Unerwartete Antwort vom Server.';
    throw new Error(message);
  }

  return data.slice(0, data.size, XLSX_MIME);
}

/**
 * Exportiert die Umsatzliste — genau wie exportTankEntries: in Edge und
 * Chrome in die einmal gewählte Datei, sonst als Download. Muss direkt aus
 * dem Klick heraus aufgerufen werden.
 */
export function exportRevenueList(options: { chooseNewFile?: boolean } = {}) {
  return exportXlsx({
    functionName: 'export-revenue-list',
    fileKey: UMSATZLISTE_FILE_KEY,
    baseName: 'Umsatzliste',
    chooseNewFile: options.chooseNewFile,
  });
}

/** Die Umsatzliste 2: die Wochen-Disposition, ein Blatt je Kalenderwoche. */
export function exportWeeklyRevenueList(options: { chooseNewFile?: boolean } = {}) {
  return exportXlsx({
    functionName: 'export-weekly-revenue',
    fileKey: UMSATZLISTE_2_FILE_KEY,
    baseName: 'Umsatzliste_2',
    chooseNewFile: options.chooseNewFile,
  });
}

/** Die Gewinnliste: Eingang, Ausgang und Gewinn der erledigten Fremdaufträge je Monat. */
export function exportExternalProfitList(options: { chooseNewFile?: boolean } = {}) {
  return exportXlsx({
    functionName: 'export-external-profit',
    fileKey: GEWINNLISTE_FILE_KEY,
    baseName: 'Gewinnliste',
    chooseNewFile: options.chooseNewFile,
  });
}

async function exportXlsx({
  functionName,
  fileKey,
  baseName,
  chooseNewFile,
}: {
  functionName: string;
  fileKey: string;
  baseName: string;
  chooseNewFile?: boolean;
}): Promise<{ savedTo: 'file' | 'download'; fileName: string }> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Der Excel-Export steht im Web-Dashboard zur Verfügung. Bitte dort herunterladen.'
    );
  }

  if (supportsRememberedFile()) {
    const fileName = await saveToRememberedFile({
      key: fileKey,
      suggestedName: `${baseName}.xlsx`,
      mimeType: XLSX_MIME,
      extension: '.xlsx',
      description: 'Excel-Tabelle',
      produce: () => fetchXlsx(functionName),
      chooseNew: chooseNewFile,
    });
    return { savedTo: 'file', fileName };
  }

  const blob = await fetchXlsx(functionName);
  const url = URL.createObjectURL(blob);
  const fileName = `${baseName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Erst im nächsten Tick freigeben, sonst bricht Safari den Download ab.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return { savedTo: 'download', fileName };
}
