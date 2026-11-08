import { dateToIso, isoToDate } from '@/lib/dateFormat';
import { supabase } from '@/lib/supabase';
import { isValidUsername } from '@/lib/username';

/**
 * Zeitlich begrenzte Zugänge für fremde Fahrer (Subunternehmer) — die
 * Chef-Seite. Ein Zugang gehört zu einer fremden Firma bzw. einem fremden
 * Fahrer und kann beliebig vielen Fremdaufträgen zugewiesen werden
 * (external_orders.assigned_external_user_id).
 *
 * Tabellen und Regeln: supabase/migrations/20260915130000_external_driver_access.sql.
 * Angelegt und gelöscht wird über die Edge Functions create-external-driver
 * und delete-external-driver, weil dabei auch das Auth-Konto entsteht bzw.
 * verschwindet; ein neues Passwort vergibt reset-external-driver-password,
 * einen neuen Benutzernamen update-external-driver. Zuweisen und Verlängern
 * laufen direkt über die Chef-Policies.
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

// Antwortet eine Function mit 4xx/5xx, liefert supabase-js `data: null` und
// einen FunctionsHttpError, der nur "non-2xx status code" sagt. Die
// eigentliche Begründung steht im JSON-Body der Antwort (error.context) —
// ohne sie sieht der Chef nicht, ob etwa der Benutzername vergeben ist.
async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const errorBody = await response.clone().json();
        if (errorBody?.error) throw new Error(String(errorBody.error));
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message) throw parseError;
      }
    }
    throw new Error(error.message ?? 'Unknown error');
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

// Rechtsformen und Füllwörter tragen nichts zur Unterscheidung bei — bei
// "voestalpine Stahl GmbH" und "voestalpine Rail Technology GmbH" zählt,
// was nach "voestalpine" kommt.
const NAME_NOISE = new Set([
  'gmbh', 'mbh', 'gesmbh', 'ges', 'ag', 'kg', 'og', 'co', 'se', 'eu', 'ltd', 'inc',
  'sro', 'srl', 'spa', 'bv', 'nv', 'kft', 'doo', 'sp', 'zoo', 'und', 'and',
]);
const USERNAME_MAX_LENGTH = 32;

/**
 * Benutzername-Vorschlag aus dem Firmennamen: alle aussagekräftigen Wörter,
 * nicht nur das erste — sonst hießen alle voestalpine-Standorte gleich und
 * würden nur durchnummeriert. "voestalpine Stahl Donawitz GmbH" →
 * "voestalpine-stahl-donawitz". Leer, wenn sich nichts Brauchbares ergibt.
 */
export function suggestUsername(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !NAME_NOISE.has(word));

  // Ganze Wörter, solange sie in die Höchstlänge passen.
  let username = '';
  for (const word of words) {
    const next = username ? `${username}-${word}` : word;
    if (next.length > USERNAME_MAX_LENGTH) break;
    username = next;
  }
  // Schon das erste Wort zu lang: dann eben abgeschnitten.
  if (!username && words.length > 0) {
    username = words[0].slice(0, USERNAME_MAX_LENGTH);
  }
  return isValidUsername(username) ? username : '';
}

export interface NewAccessCheck {
  /** Blockiert das Speichern. */
  usernameProblem: 'invalid' | 'taken' | null;
  /** Nur ein Hinweis: Ein Zugang mit genau diesem Namen existiert schon. */
  sameLabel: ExternalAccess | null;
}

/**
 * Prüft Name und Benutzername eines neuen (bzw. umbenannten) Zugangs gegen
 * die vorhandenen Zugänge — damit z. B. zwei voestalpine-Standorte nicht
 * gleich heißen und sich vertauschen. Ob ein eigener Fahrer den
 * Benutzernamen schon hat, weiß nur der Server; das meldet die Function.
 *
 * exceptUserId: der Zugang, der gerade umbenannt wird.
 */
export function checkNewAccess(
  label: string,
  username: string,
  existing: ExternalAccess[],
  exceptUserId?: string
): NewAccessCheck {
  const others = existing.filter((access) => access.userId !== exceptUserId);
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedLabel = label.trim().toLowerCase();

  let usernameProblem: NewAccessCheck['usernameProblem'] = null;
  if (!isValidUsername(normalizedUsername)) {
    usernameProblem = 'invalid';
  } else if (others.some((access) => access.username.toLowerCase() === normalizedUsername)) {
    usernameProblem = 'taken';
  }

  const sameLabel = normalizedLabel
    ? others.find((access) => access.label.trim().toLowerCase() === normalizedLabel) ?? null
    : null;

  return { usernameProblem, sameLabel };
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

/**
 * Vergibt ein neues Zufallspasswort und gibt es zurück. Das Passwort wird
 * nirgends gespeichert — es ist nur in dieser Antwort zu sehen, das alte
 * gilt ab sofort nicht mehr.
 */
export async function resetAccessPassword(userId: string): Promise<string> {
  const data = await invokeFunction<{ password: string }>('reset-external-driver-password', {
    userId,
  });
  return data.password;
}

export async function createAccess(
  label: string,
  username: string,
  expiresOn: string
): Promise<ExternalAccessCredentials> {
  const data = await invokeFunction<ExternalAccessCredentials>('create-external-driver', {
    label,
    username: username.trim().toLowerCase(),
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

/**
 * Neuer Benutzername für einen bestehenden Zugang. Das Passwort bleibt; der
 * fremde Fahrer meldet sich ab jetzt mit dem neuen Namen an.
 */
export async function renameAccess(userId: string, username: string): Promise<void> {
  await invokeFunction('update-external-driver', {
    userId,
    username: username.trim().toLowerCase(),
  });
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
