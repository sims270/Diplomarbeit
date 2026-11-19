import { supabase } from '@/lib/supabase';

/**
 * Die Sicht des fremden Fahrers (Subunternehmer) auf seine Fremdaufträge.
 *
 * Er liest external_orders nicht direkt — dort gibt es für ihn keine
 * Policy —, sondern über Funktionen, die nur die ihm zugewiesenen Aufträge
 * und nur die unverfänglichen Spalten liefern: keine Frachtrate, kein
 * Termin-Zuschlag, keine Zahlungskonditionen (siehe
 * supabase/migrations/20260915130000_external_driver_access.sql).
 */
export interface ExternalDriverOrder {
  id: string;
  orderNr: string;
  status: 'pending' | 'completed' | string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;

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

  vehicleType: string;
  notes: string;
  licensePlate: string;
  driverName: string;
  /**
   * Wann der Auftrag bestätigt wurde; null = noch offen
   * (20261119190000_external_order_confirmation.sql).
   */
  confirmedAt: string | null;
  /** 'app' = vom fremden Fahrer selbst, 'boss' = vom Chef eingetragen. */
  confirmedVia: 'app' | 'boss' | null;
}

/** So lange nach der Bestätigung ist ein Rücktritt möglich. */
export const WITHDRAW_WINDOW_MS = 60 * 60 * 1000;

/**
 * Bis wann der Rücktritt möglich ist — null, wenn gar nicht (nicht oder vom
 * Chef bestätigt). Nur zum Anzeigen; ob es noch geht, entscheidet die
 * Datenbank mit ihrer eigenen Uhr.
 */
export function withdrawDeadline(order: {
  confirmedAt: string | null;
  confirmedVia: string | null;
}): Date | null {
  if (!order.confirmedAt || order.confirmedVia !== 'app') return null;
  return new Date(Date.parse(order.confirmedAt) + WITHDRAW_WINDOW_MS);
}

export interface MyExternalAccess {
  username: string;
  label: string;
  /** Letzter gültiger Tag, 'YYYY-MM-DD' */
  expiresOn: string;
  isActive: boolean;
}

function rowToOrder(row: any): ExternalDriverOrder {
  return {
    id: row.id,
    orderNr: row.order_nr,
    status: row.status,
    completedAt: row.completed_at ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    loadingDate: row.loading_date ?? '',
    loadingTimeFrom: row.loading_time_from ?? '',
    loadingTimeUntil: row.loading_time_until ?? '',
    loadingCompany: row.loading_company ?? '',
    loadingAddress: row.loading_address ?? '',
    loadingNumber: row.loading_number ?? '',
    cargoDescription: row.cargo_description ?? '',
    loadingMeters: row.loading_meters ?? '',
    unloadingDate: row.unloading_date ?? '',
    unloadingTimeFrom: row.unloading_time_from ?? '',
    unloadingTimeUntil: row.unloading_time_until ?? '',
    unloadingCompany: row.unloading_company ?? '',
    unloadingAddress: row.unloading_address ?? '',
    vehicleType: row.vehicle_type ?? '',
    notes: row.notes ?? '',
    licensePlate: row.license_plate ?? '',
    driverName: row.driver_name ?? '',
    confirmedAt: row.confirmed_at ?? null,
    confirmedVia: row.confirmed_via ?? null,
  };
}

/** Der eigene Zugang, auch wenn er abgelaufen ist — oder null. */
export async function getMyAccess(): Promise<MyExternalAccess | null> {
  const { data, error } = await supabase.rpc('get_my_external_access');
  if (error) throw new Error(error.message);

  const row = (data as any[] | null)?.[0];
  if (!row) return null;
  return {
    username: row.username,
    label: row.label,
    expiresOn: row.expires_on,
    isActive: row.is_active,
  };
}

/** Die zugewiesenen Aufträge; bei abgelaufenem Zugang leer. */
export async function getMyOrders(): Promise<ExternalDriverOrder[]> {
  const { data, error } = await supabase.rpc('get_my_external_orders');
  if (error) throw new Error(error.message);
  return ((data as any[] | null) ?? []).map(rowToOrder);
}

export async function getMyOrder(id: string): Promise<ExternalDriverOrder | undefined> {
  return (await getMyOrders()).find((order) => order.id === id);
}

export async function completeMyOrder(id: string): Promise<void> {
  const { error } = await supabase.rpc('complete_external_order', { order_id: id });
  if (error) throw new Error(error.message);
}

/** Kennzeichen und Name des fremden Fahrers am offenen Auftrag eintragen. */
export async function setMyOrderDriver(
  id: string,
  licensePlate: string,
  driverName: string
): Promise<void> {
  const { error } = await supabase.rpc('set_external_order_driver', {
    order_id: id,
    p_license_plate: licensePlate,
    p_driver_name: driverName,
  });
  if (error) throw new Error(error.message);
}

/**
 * Bestätigt den Auftrag verbindlich. Kennzeichen und Fahrer müssen vorher
 * gespeichert sein. Fehler kommen als feste Kennung (EXT_CONFIRM_…).
 */
export async function confirmMyOrder(id: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_external_order', { order_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Rücktritt — nur innerhalb einer Stunde nach der Bestätigung. Danach ist
 * der Auftrag nicht mehr zugewiesen und verschwindet aus der Liste.
 */
export async function withdrawMyOrder(id: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_external_order', { order_id: id });
  if (error) throw new Error(error.message);
}
