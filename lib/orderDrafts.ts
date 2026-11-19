import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Entwürfe neuer Aufträge — halb ausgefüllte Formulare, die noch nicht
 * gespeichert sind (siehe hooks/use-form-draft.ts, app/chef/drafts.tsx).
 *
 * Jeder Entwurf liegt unter einem eigenen Schlüssel "orderDraft:<art>:<id>",
 * es kann also beliebig viele geben. Gespeichert in AsyncStorage (im Browser
 * localStorage): je Gerät und Browser, nicht in der Datenbank. Jeder Fehler
 * hier ist harmlos — dann gibt es eben keinen Entwurf.
 */
export type DraftKind = 'own' | 'external';

const PREFIX = 'orderDraft:';
// Aus der ersten Fassung, als es je Art nur einen Entwurf gab. Die tauchen in
// der Liste weiter auf, damit nichts verloren geht.
const LEGACY_PREFIXES: [string, DraftKind][] = [
  ['draft.ownOrder.', 'own'],
  ['draft.externalOrder.', 'external'],
];

export interface StoredDraft {
  key: string;
  kind: DraftKind;
  savedAt: string;
  /** Eigener Auftrag: { form, price }; Fremdauftrag: die Formularfelder. */
  value: unknown;
  meta: Record<string, string>;
}

/** Schlüssel für einen neuen Entwurf. */
export function newDraftKey(kind: DraftKind): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${PREFIX}${kind}:${id}`;
}

function kindOf(key: string): DraftKind | null {
  if (key.startsWith(PREFIX)) {
    const kind = key.slice(PREFIX.length).split(':')[0];
    return kind === 'own' || kind === 'external' ? kind : null;
  }
  for (const [prefix, kind] of LEGACY_PREFIXES) {
    if (key.startsWith(prefix)) return kind;
  }
  return null;
}

function parse(key: string, raw: string | null): StoredDraft | null {
  const kind = kindOf(key);
  if (!raw || !kind) return null;
  try {
    const parsed = JSON.parse(raw) as {
      savedAt?: string;
      value?: unknown;
      meta?: Record<string, string>;
    };
    if (parsed.value === undefined) return null;
    return {
      key,
      kind,
      savedAt: parsed.savedAt ?? '',
      value: parsed.value,
      meta: parsed.meta ?? {},
    };
  } catch {
    return null;
  }
}

/** Alle Entwürfe auf diesem Gerät, der zuletzt bearbeitete zuerst. */
export async function listDrafts(): Promise<StoredDraft[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => kindOf(key) !== null);
    if (keys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(keys);
    return entries
      .map(([key, raw]) => parse(key, raw))
      .filter((draft): draft is StoredDraft => draft !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function loadDraft(key: string): Promise<StoredDraft | null> {
  try {
    return parse(key, await AsyncStorage.getItem(key));
  } catch {
    return null;
  }
}

export async function saveDraft(
  key: string,
  value: unknown,
  meta: Record<string, string> = {}
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ savedAt: new Date().toISOString(), value, meta })
    );
  } catch {
    // Kein Speicher — dann eben kein Entwurf.
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nichts zu tun.
  }
}
