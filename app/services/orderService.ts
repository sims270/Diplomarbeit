import { supabase } from '@/lib/supabase';

/**
 * "Eigene Aufträge" — internal transport jobs assigned to the company's own
 * drivers, as opposed to `externalOrderService`'s orders which go to
 * subcontracted carriers. Same Transportauftrag-style PDF layout (see
 * lib/ownOrderPdf.ts), just without the recipient-company/legal-terms
 * pages that only apply once a job leaves the company.
 *
 * Persisted in Supabase (table: orders, see
 * supabase/migrations/20260907150000_create_orders.sql).
 */
export type CargoType = 'komplett' | 'beilader';

export interface Order {
  id: string;
  orderNr: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  assignedTo: string | null;
  status: string;
  // Gesetzt, sobald der Fahrer den Auftrag als erledigt markiert hat.
  completedAt: string | null;

  /**
   * Komplettladung oder Beilader — der Chef legt das beim Auftrag fest.
   * Daran hängt, ob der Fahrer beim Erledigen Kilometer eintragen muss:
   * Bei einer Komplettladung sind sie Pflicht, beim Beilader lassen sie
   * sich dieser Ladung gar nicht zuordnen und werden nicht abgefragt.
   */
  cargoType: CargoType;
  /** Anfahrt zur Ladestelle. Nur bei Komplettladung, vom Fahrer erfasst. */
  emptyKm: number | null;
  /** Ladestelle bis Entladestelle. Nur bei Komplettladung, vom Fahrer erfasst. */
  freightKm: number | null;

  loadingDate: string;
  loadingTimeFrom: string;
  loadingTimeUntil: string;
  loadingCompany: string;
  loadingAddress: string;
  loadingMeters: string;

  unloadingDate: string;
  unloadingTimeFrom: string;
  unloadingTimeUntil: string;
  unloadingCompany: string;
  unloadingAddress: string;
}

// orderNr stays editable: leaving it blank auto-assigns the next number
// from the sequence shared with externalOrderService (see fieldsToRow and
// the order_nr_seq comment in the migration) — eigene Aufträge and
// Fremdaufträge never collide on the same number. Typing one overrides it.
// emptyKm/freightKm sind hier bewusst nicht dabei: Die trägt der Fahrer
// beim Erledigen ein, nicht der Chef beim Anlegen — geschrieben werden sie
// ausschließlich über complete_order.
export type OrderFields = Omit<
  Order,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'assignedTo'
  | 'status'
  | 'completedAt'
  | 'emptyKm'
  | 'freightKm'
>;

// orders.loading_date/unloading_date are real `date` columns — an empty
// string isn't a valid date, so store that as null instead.
function toDateColumn(value: string): string | null {
  return value.trim() ? value : null;
}

function fromDateColumn(value: string | null): string {
  return value ?? '';
}

function rowToOrder(row: any): Order {
  return {
    id: row.id,
    orderNr: row.order_nr,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? '',
    assignedTo: row.assigned_to,
    status: row.status,
    completedAt: row.completed_at ?? null,
    cargoType: (row.cargo_type as CargoType | null) ?? 'komplett',
    emptyKm: row.empty_km ?? null,
    freightKm: row.freight_km ?? null,
    loadingDate: fromDateColumn(row.loading_date),
    loadingTimeFrom: row.loading_time_from,
    loadingTimeUntil: row.loading_time_until,
    loadingCompany: row.loading_company,
    loadingAddress: row.loading_address,
    loadingMeters: row.loading_meters,
    unloadingDate: fromDateColumn(row.unloading_date),
    unloadingTimeFrom: row.unloading_time_from,
    unloadingTimeUntil: row.unloading_time_until,
    unloadingCompany: row.unloading_company,
    unloadingAddress: row.unloading_address,
  };
}

// Leaves order_nr out of the row entirely when blank, so Postgres' column
// default (nextval on order_nr_seq) assigns the next number on insert, or —
// on update — the existing value is left untouched instead of being
// overwritten with an empty string.
function fieldsToRow(data: OrderFields): Record<string, unknown> {
  const row: Record<string, unknown> = {
    cargo_type: data.cargoType,
    loading_date: toDateColumn(data.loadingDate),
    loading_time_from: data.loadingTimeFrom,
    loading_time_until: data.loadingTimeUntil,
    loading_company: data.loadingCompany,
    loading_address: data.loadingAddress,
    loading_meters: data.loadingMeters,
    unloading_date: toDateColumn(data.unloadingDate),
    unloading_time_from: data.unloadingTimeFrom,
    unloading_time_until: data.unloadingTimeUntil,
    unloading_company: data.unloadingCompany,
    unloading_address: data.unloadingAddress,
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
    return new Error('Diese Transportnummer ist bereits vergeben. Bitte eine andere wählen.');
  }
  return new Error(error.message);
}

export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data.map(rowToOrder);
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToOrder(data) : undefined;
}

export async function getOrdersByDriver(driverId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_to', driverId)
    .order('loading_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data.map(rowToOrder);
}

export async function addOrder(data: OrderFields): Promise<Order> {
  const { data: row, error } = await supabase
    .from('orders')
    .insert({ ...fieldsToRow(data), status: 'pending' })
    .select('*')
    .single();

  if (error) throw toFriendlyError(error);
  return rowToOrder(row);
}

export async function updateOrder(id: string, data: OrderFields): Promise<Order> {
  const { data: row, error } = await supabase
    .from('orders')
    .update({ ...fieldsToRow(data), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw toFriendlyError(error);
  return rowToOrder(row);
}

export async function assignOrderToDriver(orderId: string, driverId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ assigned_to: driverId, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw new Error(error.message);
}

// Der einzige Schreibzugriff, den ein Fahrer auf orders hat. Läuft über
// die RPC-Funktion complete_order (siehe
// supabase/migrations/20260908110000_driver_complete_order.sql), die den
// Status setzt und dabei selbst prüft, dass der Auftrag dem angemeldeten
// Fahrer gehört — die orders-Policies erlauben Fahrern kein UPDATE.
// Die Kilometer gehen hier mit durch: Bei einer Komplettladung besteht die
// Funktion selbst darauf (siehe 20260914100000), beim Beilader verwirft sie
// sie — zu dieser Ladung allein gehören keine Kilometer.
export async function completeOrder(
  orderId: string,
  km: { emptyKm: number | null; freightKm: number | null } = {
    emptyKm: null,
    freightKm: null,
  }
): Promise<Order> {
  const { data, error } = await supabase.rpc('complete_order', {
    order_id: orderId,
    empty_km: km.emptyKm,
    freight_km: km.freightKm,
  });

  if (error) throw new Error(error.message);
  return rowToOrder(data);
}

export async function getOrderStats(): Promise<{
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
}> {
  const orders = await getAllOrders();
  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    assigned: orders.filter((o) => o.status === 'assigned').length,
    inProgress: orders.filter((o) => o.status === 'in_progress').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };
}
