import { dateToIso, isoToDate } from '@/lib/dateFormat';
import { supabase } from '@/lib/supabase';

/**
 * Zeitlich begrenzte Zugänge für fremde Fahrer (Subunternehmer) — die
 * Chef-Seite. Ein Zugang gehört zu einer fremden Firma bzw. einem fremden
 * Fahrer und kann beliebig vielen Fremdaufträgen zugewiesen werden
 * (external_orders.assigned_external_user_id).
 *
 * Tabellen und Regeln: supabase/migrations/20260915130000_external_driver_access.sql.
 * Angelegt und gelöscht wird über die Edge Functions create-external-driver
 * und delete-external-driver, weil dabei auch das Auth-Konto entsteht bzw.
 * verschwindet. Zuweisen, Verlängern und das Passwort anzeigen laufen
 * direkt über die Chef-Policies.
 */
export interface ExternalAccess {
  userId: string;
  username: string;
  /** Firmenname zum Wiedererkennen */
  label: string;
  /** Letzter gültiger Tag, 'YYYY-MM-DD' */
  expiresOn: string;
  createdAt: string;
  /** Wie viele Fremdaufträge diesem Zugang zugewiesen sind */
  orderCount: number;
  isActive: boolean;
}

export interface ExternalAccessCredentials {
  userId: string;
  username: string;
  password: string;
  label: string;
  expiresOn: string;
}

/** Wie lange ein neuer Zugang standardmäßig gilt, gerechnet ab dem Entladedatum. */
export const DEFAULT_ACCESS_DAYS = 7;

export function todayIso(): string {
  return dateToIso(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = isoToDate(isoDate);
  date.setDate(date.getDate() + days);
  return dateToIso(date);
}

/**
 * Vorschlag für "gültig bis": eine Woche nach dem Entladedatum — bis dahin
 * sind die Belege normalerweise hochgeladen. Ohne (oder mit vergangenem)
 * Entladedatum eine Woche ab heute.
 */
export function suggestExpiresOn(unloadingDate: string): string {
  const today = todayIso();
  const start = unloadingDate && unloadingDate > today ? unloadingDate : today;
  return addDays(start, DEFAULT_ACCESS_DAYS);
}

// Der Zugang gilt bis 23:59 Wiener Zeit am Ablauftag. Die Datenbank prüft
// das genau so (public.vienna_today()); hier genügt das Datum des Geräts.
function isActiveOn(expiresOn: string): boolean {
  return expiresOn >= todayIso();
}

// supabase-js only rejects `error` for transport/network failures; our
// functions return 4xx/5xx bodies with an `error` field on failure, so
// both cases need checking (same as driverService.ts).
async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error || data?.error) {
    throw new Error(data?.error ?? error?.message ?? 'Unknown error');
  }
  return data as T;
}

export async function getAccesses(): Promise<ExternalAccess[]> {
  const [accounts, assignments] = await Promise.all([
    supabase
      .from('external_driver_accounts')
      .select('user_id, username, label, expires_on, created_at')
      .order('label'),
    supabase
      .from('external_orders')
      .select('assigned_external_user_id')
      .not('assigned_external_user_id', 'is', null),
  ]);

  if (accounts.error) throw new Error(accounts.error.message);
  if (assignments.error) throw new Error(assignments.error.message);

  const counts = new Map<string, number>();
  for (const row of assignments.data) {
    const id = row.assigned_external_user_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return accounts.data.map((row) => ({
    userId: row.user_id,
    username: row.username,
    label: row.label,
    expiresOn: row.expires_on,
    createdAt: row.created_at,
    orderCount: counts.get(row.user_id) ?? 0,
    isActive: isActiveOn(row.expires_on),
  }));
}

export async function getExpiredAccesses(): Promise<ExternalAccess[]> {
  return (await getAccesses()).filter((access) => !access.isActive);
}

export async function getAccessPassword(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('external_driver_accounts')
    .select('password')
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data.password;
}

export async function createAccess(
  label: string,
  expiresOn: string
): Promise<ExternalAccessCredentials> {
  const data = await invokeFunction<ExternalAccessCredentials>('create-external-driver', {
    label,
    expiresOn,
  });
  return {
    userId: data.userId,
    username: data.username,
    password: data.password,
    label: data.label,
    expiresOn: data.expiresOn,
  };
}

/** Der Zugang, dem der Fremdauftrag zugewiesen ist, oder null. */
export async function getAssignedAccessId(orderId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('external_orders')
    .select('assigned_external_user_id')
    .eq('id', orderId)
    .single();

  if (error) throw new Error(error.message);
  return data.assigned_external_user_id ?? null;
}

/** null hebt die Zuweisung auf. */
export async function assignOrder(orderId: string, userId: string | null): Promise<void> {
  const { data, error } = await supabase
    .from('external_orders')
    .update({ assigned_external_user_id: userId })
    .eq('id', orderId)
    .select('id');

  if (error) throw new Error(error.message);
  // Verweigert RLS das Update, kommt kein Fehler, nur keine Zeile zurück.
  if (!data || data.length === 0) {
    throw new Error('Auftrag konnte nicht zugewiesen werden.');
  }
}

/**
 * Verlängert um `days` Tage — gerechnet ab dem bisherigen Ablaufdatum, bei
 * einem schon abgelaufenen Zugang ab heute. Gibt das neue Datum zurück.
 */
export async function extendAccess(access: ExternalAccess, days: number): Promise<string> {
  const today = todayIso();
  const start = access.expiresOn > today ? access.expiresOn : today;
  const expiresOn = addDays(start, days);

  const { data, error } = await supabase
    .from('external_driver_accounts')
    .update({ expires_on: expiresOn })
    .eq('user_id', access.userId)
    .select('user_id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Zugang konnte nicht verlängert werden.');
  }
  return expiresOn;
}

/**
 * Löscht das Konto. Die hochgeladenen Belege bleiben beim Auftrag, nur die
 * Zuweisung fällt weg.
 */
export async function deleteAccess(userId: string): Promise<void> {
  await invokeFunction('delete-external-driver', { userId });
}
