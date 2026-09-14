import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

/**
 * Rechnungen zu erledigten Aufträgen: als Einzelrechnung (eine Ladung) oder
 * als Sammelrechnung (mehrere Ladungen auf einer Rechnung — große Kunden
 * wollen nicht jede Fahrt einzeln verrechnet haben). Bearbeitbar im
 * Chef-Dashboard, herunterladbar als Excel-Datei.
 *
 * Angelegt, vorbefüllt und um Ladungen erweitert wird serverseitig von der
 * Edge Function export-invoice (dort wird auch die Belegnummer vergeben) —
 * dieselbe Aufteilung wie beim Tanklisten-Export in
 * app/services/tankEntryService.ts: exceljs ist keine Abhängigkeit der App,
 * und die Function prüft zugleich, dass wirklich ein Chef-Account fragt.
 *
 * Geändert wird danach direkt auf den Tabellen invoices und invoice_items —
 * dafür genügen die RLS-Policies, es braucht keinen Serverumweg.
 * Tabellen: supabase/migrations/20260914130000_add_collective_invoices.sql
 */
export interface InvoiceHeader {
  id: string;
  belegnummer: string;
  /** ISO 'YYYY-MM-DD', wie überall im Projekt (siehe lib/dateFormat.ts) */
  rechnungsdatum: string;
  empfaengerName: string;
  empfaengerStrasse: string;
  empfaengerOrt: string;
  kundennummer: string;
  uidNummer: string;
  ustSatz: string;
  zahlungsziel: string;
}

/** Eine Position = eine verrechnete Ladung (ein Auftrag). */
export interface InvoiceItem {
  id: string;
  orderId: string;
  /** Nur zur Anzeige — auf der Rechnung steht die bearbeitbare transportnr. */
  orderNr: string;
  positionDatum: string;
  bezeichnung: string;
  transportnr: string;
  ladestelle: string;
  ladedatum: string;
  entladestelle: string;
  entladedatum: string;
  /** Leer, solange kein Preis vereinbart ist — dann bleibt die Zelle leer. */
  preis: string;
}

export interface Invoice {
  header: InvoiceHeader;
  items: InvoiceItem[];
}

/** Ein erledigter Auftrag, der noch auf keiner Rechnung steht. */
export interface BillableOrder {
  id: string;
  orderNr: string;
  loadingCompany: string;
  unloadingCompany: string;
  /** ISO 'YYYY-MM-DD' — Ladedatum, sonst Entladedatum; leer, wenn beides fehlt. */
  date: string;
}

type Nullable = string | number | null | undefined;

interface InvoiceResponse {
  invoice: Record<string, Nullable> | null;
  items: Record<string, Nullable>[];
}

// Im Formular ist jedes Feld ein Textfeld — null aus der Datenbank wird
// deshalb zum leeren String, nicht zu "null" im Eingabefeld.
function text(value: Nullable): string {
  return value === null || value === undefined ? '' : String(value);
}

function toInvoice(response: InvoiceResponse): Invoice | null {
  const row = response.invoice;
  if (!row) return null;

  return {
    header: {
      id: text(row.id),
      belegnummer: text(row.belegnummer),
      rechnungsdatum: text(row.rechnungsdatum),
      empfaengerName: text(row.empfaenger_name),
      empfaengerStrasse: text(row.empfaenger_strasse),
      empfaengerOrt: text(row.empfaenger_ort),
      kundennummer: text(row.kundennummer),
      uidNummer: text(row.uid_nummer),
      ustSatz: text(row.ust_satz),
      zahlungsziel: text(row.zahlungsziel),
    },
    items: (response.items ?? []).map((item) => ({
      id: text(item.id),
      orderId: text(item.order_id),
      orderNr: text(item.order_nr),
      positionDatum: text(item.position_datum),
      bezeichnung: text(item.bezeichnung),
      transportnr: text(item.transportnr),
      ladestelle: text(item.ladestelle),
      ladedatum: text(item.ladedatum),
      entladestelle: text(item.entladestelle),
      entladedatum: text(item.entladedatum),
      preis: text(item.preis),
    })),
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

/** Ruft eine JSON-Aktion der Function auf und liefert die Rechnung zurück. */
async function invokeInvoiceAction(body: Record<string, unknown>): Promise<Invoice | null> {
  const { data, error } = await supabase.functions.invoke('export-invoice', {
    method: 'POST',
    body,
  });

  if (error) {
    throw new Error(await describeFunctionError(error));
  }

  if (!data || typeof data !== 'object' || !('invoice' in data)) {
    throw new Error('Unerwartete Antwort vom Server.');
  }

  return toInvoice(data as InvoiceResponse);
}

/**
 * Die Rechnung, auf der der Auftrag steht — oder null, wenn er noch nicht
 * verrechnet ist. Angelegt wird hier bewusst nichts: ob Einzel- oder
 * Sammelrechnung, entscheidet der Chef.
 */
export async function loadInvoiceForOrder(orderId: string): Promise<Invoice | null> {
  return invokeInvoiceAction({ action: 'load', orderId });
}

/**
 * Legt eine Rechnung über die Aufträge an: einer ergibt die
 * Einzelrechnung, mehrere die Sammelrechnung. Vergibt die Belegnummer und
 * füllt alles aus den Aufträgen vor.
 */
export async function createInvoice(orderIds: string[]): Promise<Invoice> {
  const invoice = await invokeInvoiceAction({ action: 'create', orderIds });
  if (!invoice) throw new Error('Rechnung konnte nicht angelegt werden.');
  return invoice;
}

/** Nimmt weitere Ladungen auf eine bestehende Rechnung. */
export async function addInvoiceItems(invoiceId: string, orderIds: string[]): Promise<Invoice> {
  const invoice = await invokeInvoiceAction({ action: 'addItems', invoiceId, orderIds });
  if (!invoice) throw new Error('Ladungen konnten nicht hinzugefügt werden.');
  return invoice;
}

/** Nimmt eine Ladung wieder von der Rechnung — die letzte bleibt immer stehen. */
export async function removeInvoiceItem(invoiceId: string, itemId: string): Promise<Invoice> {
  const invoice = await invokeInvoiceAction({ action: 'removeItem', invoiceId, itemId });
  if (!invoice) throw new Error('Ladung konnte nicht entfernt werden.');
  return invoice;
}

/**
 * Erledigte Aufträge, die noch auf keiner Rechnung stehen — die Auswahl für
 * die Sammelrechnung. Direkt aus der Datenbank, die RLS-Policies des Chefs
 * erlauben das Lesen beider Tabellen.
 */
export async function getBillableOrders(): Promise<BillableOrder[]> {
  const [ordersResult, itemsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_nr, loading_company, unloading_company, loading_date, unloading_date')
      .eq('status', 'completed')
      .order('loading_date', { ascending: false, nullsFirst: false }),
    supabase.from('invoice_items').select('order_id'),
  ]);

  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const billed = new Set((itemsResult.data ?? []).map((row) => row.order_id as string));

  return (ordersResult.data ?? [])
    .filter((row) => !billed.has(row.id))
    .map((row) => ({
      id: row.id,
      orderNr: row.order_nr ?? '',
      loadingCompany: row.loading_company ?? '',
      unloadingCompany: row.unloading_company ?? '',
      date: row.loading_date ?? row.unloading_date ?? '',
    }));
}

/**
 * Speichert die Änderungen des Chefs — Kopf und alle Positionen. Die
 * Belegnummer wird mitgeschrieben: vergeben wird sie zwar automatisch,
 * korrigieren darf er sie trotzdem — etwa wenn in der Buchhaltung schon eine
 * andere Nummer vergeben wurde.
 */
export async function saveInvoice(invoice: Invoice): Promise<void> {
  const { header, items } = invoice;
  const now = new Date().toISOString();

  const results = await Promise.all([
    supabase
      .from('invoices')
      .update({
        belegnummer: header.belegnummer.trim(),
        rechnungsdatum: toDateColumn(header.rechnungsdatum),
        empfaenger_name: header.empfaengerName.trim(),
        empfaenger_strasse: header.empfaengerStrasse.trim(),
        empfaenger_ort: header.empfaengerOrt.trim(),
        kundennummer: header.kundennummer.trim(),
        uid_nummer: header.uidNummer.trim(),
        ust_satz: parseAmount(header.ustSatz),
        zahlungsziel: header.zahlungsziel.trim(),
        updated_at: now,
      })
      .eq('id', header.id),
    ...items.map((item) =>
      supabase
        .from('invoice_items')
        .update({
          position_datum: toDateColumn(item.positionDatum),
          bezeichnung: item.bezeichnung.trim(),
          transportnr: item.transportnr.trim(),
          ladestelle: item.ladestelle.trim(),
          ladedatum: toDateColumn(item.ladedatum),
          entladestelle: item.entladestelle.trim(),
          entladedatum: toDateColumn(item.entladedatum),
          preis: parseAmount(item.preis),
        })
        .eq('id', item.id)
    ),
  ]);

  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/**
 * Lädt die Rechnung als Excel-Datei herunter.
 *
 * Nur für Web: das Chef-Dashboard läuft im Browser (Vercel). Nativ gäbe es
 * keinen Ort, an den ein Browser-Download gehen könnte, deshalb hier ein
 * klarer Hinweis statt eines Buttons, der nichts tut.
 */
export async function downloadInvoiceXlsx(invoice: Invoice): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Die Rechnung steht im Web-Dashboard zur Verfügung. Bitte dort herunterladen.'
    );
  }

  const { data, error } = await supabase.functions.invoke('export-invoice', {
    method: 'POST',
    body: { action: 'export', invoiceId: invoice.header.id },
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

  // Die Einzelrechnung heißt weiter nach dem Auftrag; die Sammelrechnung hat
  // keinen einzelnen Auftrag, sie heißt nach ihrer Belegnummer ("01/2026"
  // wird zu "01-2026" — ein Schrägstrich ist im Dateinamen nicht erlaubt).
  const fileName =
    invoice.items.length === 1
      ? `Rechnung_${invoice.items[0].orderNr}.xlsx`
      : `Sammelrechnung_${invoice.header.belegnummer.replace(/\//g, '-')}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Erst im nächsten Tick freigeben: Safari bricht den gerade gestarteten
  // Download ab, wenn die URL noch im selben Durchlauf verworfen wird.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
