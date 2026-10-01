import { supabase } from '@/lib/supabase';

/**
 * Chef-Konten. Läuft wie die Fahrerverwaltung über Edge Functions: Konten
 * anzulegen oder zu löschen braucht den service_role-Schlüssel, und der
 * bleibt serverseitig.
 *
 * Die Edge Functions prüfen alles noch einmal selbst — insbesondere, dass
 * niemand sich selbst oder den letzten Chef löscht.
 */
export interface Boss {
  id: string;
  username: string;
  name: string;
  createdAt: string;
  /** True für das Konto, mit dem man gerade angemeldet ist. */
  isSelf: boolean;
}

/** Fehlerschlüssel aus delete-boss, von der Oberfläche übersetzt. */
export const CANNOT_DELETE_SELF = 'CANNOT_DELETE_SELF';
export const CANNOT_DELETE_LAST_BOSS = 'CANNOT_DELETE_LAST_BOSS';

// supabase-js meldet `error` nur bei Netzwerkfehlern; unsere Functions
// antworten bei Problemen mit 4xx/5xx und einem `error`-Feld im Body.
function unwrap(data: any, error: any): void {
  if (error || data?.error) {
    throw new Error(data?.error ?? error?.message ?? 'Unknown error');
  }
}

export async function getBosses(): Promise<Boss[]> {
  const { data, error } = await supabase.functions.invoke('list-bosses', {
    method: 'GET',
  });
  unwrap(data, error);
  return data.bosses ?? [];
}

export async function createBoss(
  username: string,
  password: string,
  name: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-boss', {
    body: { username: username.trim(), password, name: name.trim() },
  });
  unwrap(data, error);
}

export async function deleteBoss(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-boss', {
    body: { userId },
  });
  unwrap(data, error);
}
