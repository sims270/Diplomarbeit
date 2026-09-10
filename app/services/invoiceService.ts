import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

/**
 * Die Rechnung zu einem erledigten Auftrag: bearbeitbar im Chef-Dashboard,
 * herunterladbar als Excel-Datei.
 *
 * Angelegt und vorbefüllt wird sie serverseitig von der Edge Function
 * export-invoice (dort wird auch die Belegnummer vergeben) — dieselbe
 * Aufteilung wie beim Tanklisten-Export in
 * app/services/tankEntryService.ts: exceljs ist keine Abhängigkeit der App,
 * und die Function prüft zugleich, dass wirklich ein Chef-Account fragt.
 *
 * Geändert wird danach direkt auf der Tabelle invoices — dafür genügt die
 * RLS-Policy "Boss can edit invoices", es braucht keinen Serverumweg.
 * Tabelle: supabase/migrations/20260910120000_create_invoices.sql
 */
export interface Invoice {
  belegnummer: string;
  /** ISO 'YYYY-MM-DD', wie überall im Projekt (siehe lib/dateFormat.ts) */
  rechnungsdatum: string;
  empfaengerName: string;
  empfaengerStrasse: string;
  empfaengerOrt: string;
  kundennummer: string;
  uidNummer: string;
  positionDatum: string;
  bezeichnung: string;
  transportnr: string;
  ladestelle: string;
  ladedatum: string;
  entladestelle: string;
  entladedatum: string;
  /** Leer, solange kein Preis vereinbart ist — dann bleibt die Zelle leer. */
  preis: string;
  ustSatz: string;
  zahlungsziel: string;
}

interface InvoiceRow {
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

// Im Formular ist jedes Feld ein Textfeld — null aus der Datenbank wird
// deshalb zum leeren String, nicht zu "null" im Eingabefeld.
function text(value: string | number | null): string {
  return value === null || value === undefined ? '' : String(value);
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    belegnummer: text(row.belegnummer),
    rechnungsdatum: text(row.rechnungsdatum),
    empfaengerName: text(row.empfaenger_name),
    empfaengerStrasse: text(row.empfaenger_strasse),
    empfaengerOrt: text(row.empfaenger_ort),
    kundennummer: text(row.kundennummer),
    uidNummer: text(row.uid_nummer),
    positionDatum: text(row.position_datum),
    bezeichnung: text(row.bezeichnung),
    transportnr: text(row.transportnr),
    ladestelle: text(row.ladestelle),
    ladedatum: text(row.ladedatum),
    entladestelle: text(row.entladestelle),
    entladedatum: text(row.entladedatum),
    preis: text(row.preis),
    ustSatz: text(row.ust_satz),
    zahlungsziel: text(row.zahlungsziel),
  };
}

/**
 * Beträge, wie sie hier getippt werden: "1395", "1.395,00", "1395.5". Ein
 * reines Number() ergäbe aus den ersten beiden NaN. Gleiche Regel wie bei
 * den Litern in tankEntryService: das Komma entscheidet — steht eines drin,
 * ist es das Dezimaltrennzeichen und Punkte sind Tausenderpunkte.
 */
function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// date-Spalten vertragen keinen leeren String — leer heißt hier null.
function toDateColumn(value: string): string | null {
  return value.trim() ? value : null;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Rohtexte aus supabase-js sind für den Chef im Dashboard wertlos:
 * FunctionsHttpError meldet nur "non-2xx status code" — die Begründung
 * steht im JSON-Body der Antwort. FunctionsFetchError heißt in der Praxis
 * fast immer, dass die Function noch nicht deployt ist: das Gateway
 * antwortet dann ohne CORS-Header, und der Browser verwirft die Antwort,
 * bevor supabase-js den Status überhaupt sieht.
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
      'Die Edge Function "export-invoice" ist nicht erreichbar. ' +
      'Sie muss einmalig deployt werden:\n\n' +
      'supabase functions deploy export-invoice'
    );
  }

  return error.message ?? 'Rechnung konnte nicht geladen werden.';
}

/**
 * Lädt die Rechnung zum Auftrag. Existiert noch keine, legt die Edge
 * Function sie an und füllt sie aus dem Auftrag vor — der Aufrufer bekommt
 * also immer eine vollständige Rechnung zurück.
 */
export async function loadInvoice(orderId: string): Promise<Invoice> {
  const { data, error } = await supabase.functions.invoke('export-invoice', {
    method: 'POST',
    body: { orderId, action: 'load' },
  });

  if (error) {
    throw new Error(await describeFunctionError(error));
  }

  const row = (data as { invoice?: InvoiceRow } | null)?.invoice;
  if (!row) {
    throw new Error('Unerwartete Antwort vom Server.');
  }

  return rowToInvoice(row);
}

/**
 * Speichert die Änderungen des Chefs. Die Belegnummer wird mitgeschrieben:
 * vergeben wird sie zwar automatisch, korrigieren darf er sie trotzdem —
 * etwa wenn in der Buchhaltung schon eine andere Nummer vergeben wurde.
 */
export async function saveInvoice(orderId: string, invoice: Invoice): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({
      belegnummer: invoice.belegnummer.trim(),
      rechnungsdatum: toDateColumn(invoice.rechnungsdatum),
      empfaenger_name: invoice.empfaengerName.trim(),
      empfaenger_strasse: invoice.empfaengerStrasse.trim(),
      empfaenger_ort: invoice.empfaengerOrt.trim(),
      kundennummer: invoice.kundennummer.trim(),
      uid_nummer: invoice.uidNummer.trim(),
      position_datum: toDateColumn(invoice.positionDatum),
      bezeichnung: invoice.bezeichnung.trim(),
      transportnr: invoice.transportnr.trim(),
      ladestelle: invoice.ladestelle.trim(),
      ladedatum: toDateColumn(invoice.ladedatum),
      entladestelle: invoice.entladestelle.trim(),
      entladedatum: toDateColumn(invoice.entladedatum),
      preis: parseAmount(invoice.preis),
      ust_satz: parseAmount(invoice.ustSatz),
      zahlungsziel: invoice.zahlungsziel.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  if (error) throw new Error(error.message);
}

/**
 * Lädt die Rechnung als Excel-Datei herunter. `orderNr` geht nur in den
 * Dateinamen ein — welcher Auftrag gemeint ist, entscheidet allein die id.
 *
 * Nur für Web: das Chef-Dashboard läuft im Browser (Vercel). Nativ gäbe es
 * keinen Ort, an den ein Browser-Download gehen könnte, deshalb hier ein
 * klarer Hinweis statt eines Buttons, der nichts tut.
 */
export async function downloadInvoiceXlsx(orderId: string, orderNr: string): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Die Rechnung steht im Web-Dashboard zur Verfügung. Bitte dort herunterladen.'
    );
  }

  const { data, error } = await supabase.functions.invoke('export-invoice', {
    method: 'POST',
    body: { orderId },
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

  const link = document.createElement('a');
  link.href = url;
  link.download = `Rechnung_${orderNr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Erst im nächsten Tick freigeben: Safari bricht den gerade gestarteten
  // Download ab, wenn die URL noch im selben Durchlauf verworfen wird.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
