import { supabase } from '@/lib/supabase';

/**
 * Orders dispatched to external/subcontracted carriers ("fremde LKW"),
 * as opposed to the plain `orderService` orders which go to the company's
 * own fleet/drivers. Each of these renders into a formal "Transportauftrag"
 * PDF — see lib/transportauftragPdf.ts.
 *
 * Persisted in Supabase (table: external_orders, see
 * supabase/migrations/20260907140000_create_external_orders.sql) so a boss
 * can come back and edit one after creating it.
 */
export interface ExternalOrder {
  id: string;
  orderNr: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  recipientCompany: string;
  recipientContact: string;
  /** Vollständige Anschrift des Empfängers, mehrzeilig auf dem Transportauftrag unter der Firma. */
  recipientAddress: string;

  loadingDate: string;
  loadingTimeFrom: string;
  loadingTimeUntil: string;
  loadingCompany: string;
  loadingAddress: string;
  loadingNumber: string;
  cargoDescription: string;
  loadingMeters: string;

  unloadingDate: string;
  unloadingTimeFrom: string;
  unloadingTimeUntil: string;
  unloadingCompany: string;
  unloadingAddress: string;

  freightRate: string;
  deadlineSurcharge: string;
  paymentTerms: string;

  vehicleType: string;
  notes: string;

  licensePlate?: string;
  driverName?: string;

  /**
   * Auftraggeber — bekommt die Rechnung. Leer = die Ladestelle ist der
   * Auftraggeber. Nicht zu verwechseln mit recipientCompany, dem fremden
   * Frachtführer. Steht auf keinem PDF und nicht in der App des fremden
   * Fahrers (siehe 20261005150000_add_client_to_orders.sql).
   */
  clientCompany: string;
  /** Anschrift des Auftraggebers, aus der Firmenliste mitgenommen; leer, wenn getippt. */
  clientAddress: string;

  /**
   * 'pending' bis zum Abschluss, dann 'completed' — wie bei den eigenen
   * Aufträgen (Spalte aus 20260915130000_external_driver_access.sql).
   * Abschließen kann ihn der fremde Fahrer in seiner App oder der Chef
   * (markExternalOrderCompleted). Erst dann lässt er sich verrechnen.
   */
  status: string;
  completedAt: string | null;
}

// orderNr stays editable: leaving it blank auto-assigns the next number
// from the sequence shared with orderService (see fieldsToRow and the
// order_nr_seq comment in the migration) — Fremdaufträge and eigene
// Aufträge never collide on the same number. Typing one overrides it.
// Status und Abschluss gehören nicht ins Formular — die setzt das Erledigen.
export type ExternalOrderFields = Omit<
  ExternalOrder,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'
>;

// external_orders.loading_date/unloading_date are real `date` columns —
// an empty string isn't a valid date, so store that as null instead.
function toDateColumn(value: string): string | null {
  return value.trim() ? value : null;
}

function fromDateColumn(value: string | null): string {
  return value ?? '';
}

function rowToOrder(row: any): ExternalOrder {
  return {
    id: row.id,
    orderNr: row.order_nr,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? '',
    recipientCompany: row.recipient_company,
    recipientContact: row.recipient_contact,
    recipientAddress: row.recipient_address ?? '',
    loadingDate: fromDateColumn(row.loading_date),
    loadingTimeFrom: row.loading_time_from,
    loadingTimeUntil: row.loading_time_until,
    loadingCompany: row.loading_company,
    loadingAddress: row.loading_address,
    loadingNumber: row.loading_number,
    cargoDescription: row.cargo_description,
    loadingMeters: row.loading_meters,
    unloadingDate: fromDateColumn(row.unloading_date),
    unloadingTimeFrom: row.unloading_time_from,
    unloadingTimeUntil: row.unloading_time_until,
    unloadingCompany: row.unloading_company,
    unloadingAddress: row.unloading_address,
    freightRate: row.freight_rate,
    deadlineSurcharge: row.deadline_surcharge,
    paymentTerms: row.payment_terms,
    vehicleType: row.vehicle_type,
    notes: row.notes,
    licensePlate: row.license_plate ?? '',
    driverName: row.driver_name ?? '',
    clientCompany: row.client_company ?? '',
    clientAddress: row.client_address ?? '',
    status: row.status ?? 'pending',
    completedAt: row.completed_at ?? null,
  };
}

// Leaves order_nr out of the row entirely when blank, so Postgres' column
// default (nextval on external_order_nr_seq) assigns the next number on
// insert, or — on update — the existing value is left untouched instead of
// being overwritten with an empty string.
function fieldsToRow(data: ExternalOrderFields): Record<string, unknown> {
  const row: Record<string, unknown> = {
    recipient_company: data.recipientCompany,
    recipient_contact: data.recipientContact,
    recipient_address: data.recipientAddress,
    loading_date: toDateColumn(data.loadingDate),
    loading_time_from: data.loadingTimeFrom,
    loading_time_until: data.loadingTimeUntil,
    loading_company: data.loadingCompany,
    loading_address: data.loadingAddress,
    loading_number: data.loadingNumber,
    cargo_description: data.cargoDescription,
    loading_meters: data.loadingMeters,
    unloading_date: toDateColumn(data.unloadingDate),
    unloading_time_from: data.unloadingTimeFrom,
    unloading_time_until: data.unloadingTimeUntil,
    unloading_company: data.unloadingCompany,
    unloading_address: data.unloadingAddress,
    freight_rate: data.freightRate,
    deadline_surcharge: data.deadlineSurcharge,
    payment_terms: data.paymentTerms,
    vehicle_type: data.vehicleType,
    notes: data.notes,
    license_plate: data.licensePlate || null,
    driver_name: data.driverName || null,
    client_company: data.clientCompany.trim(),
    // Ohne Auftraggeber auch keine Anschrift — sonst bliebe eine alte stehen.
    client_address: data.clientCompany.trim() ? data.clientAddress.trim() : '',
  };

  if (data.orderNr.trim()) {
    row.order_nr = data.orderNr.trim();
  }

  return row;
}

// Postgres' unique_violation code — thrown when a manually typed order
// number collides with one that already exists.
const UNIQUE_VIOLATION = '23505';

function toFriendlyError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION) {
    return new Error('Diese Auftragsnummer ist bereits vergeben. Bitte eine andere wählen.');
  }
  return new Error(error.message);
}

export async function getAllExternalOrders(): Promise<ExternalOrder[]> {
  const { data, error } = await supabase
    .from('external_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data.map(rowToOrder);
}

export async function getExternalOrderById(id: string): Promise<ExternalOrder | undefined> {
  const { data, error } = await supabase
    .from('external_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToOrder(data) : undefined;
}

export async function addExternalOrder(data: ExternalOrderFields): Promise<ExternalOrder> {
  const { data: row, error } = await supabase
    .from('external_orders')
    .insert(fieldsToRow(data))
    .select('*')
    .single();

  if (error) throw toFriendlyError(error);
  return rowToOrder(row);
}

/**
 * Der Chef schließt einen Fremdauftrag selbst ab — für Frachtführer ohne
 * Zugang zur App, die ihn sonst nie erledigen könnten. Danach lässt er sich
 * verrechnen. Die Policy "Boss can edit external orders" erlaubt das.
 *
 * Nur, solange er noch offen ist: ein schon erledigter behält seinen
 * ursprünglichen Abschlusszeitpunkt.
 */
export async function markExternalOrderCompleted(id: string): Promise<ExternalOrder> {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from('external_orders')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .eq('id', id)
    .neq('status', 'completed')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (row) return rowToOrder(row);

  // Schon erledigt (etwa vom fremden Fahrer gerade eben) — den aktuellen Stand zurückgeben.
  const current = await getExternalOrderById(id);
  if (!current) throw new Error('Fremdauftrag nicht gefunden.');
  return current;
}

export async function updateExternalOrder(
  id: string,
  data: ExternalOrderFields
): Promise<ExternalOrder> {
  const { data: row, error } = await supabase
    .from('external_orders')
    .update({ ...fieldsToRow(data), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw toFriendlyError(error);
  return rowToOrder(row);
}
