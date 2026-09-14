import { Platform } from 'react-native';

/**
 * Schreibt einen Export direkt in eine Datei auf dem Rechner des Chefs,
 * statt ihn jedes Mal in "Downloads" abzulegen.
 *
 * Grundlage ist die File System Access API: Der Chef wählt die Datei beim
 * ersten Export einmal aus, der Browser gibt der Seite dafür einen "Handle"
 * — eine Art Schlüssel zu genau dieser einen Datei. Den merken wir uns in
 * IndexedDB (localStorage kann nur Text, ein Handle ist ein Objekt). Bei
 * jedem weiteren Export wird die Datei damit überschrieben.
 *
 * Bewusst überschreiben, nicht anhängen: Der Export enthält immer die
 * vollständige Tankliste inklusive der in der App eingetragenen Preise. Die
 * neue Datei ist also nie ärmer als die alte. Anhängen an eine Datei, die
 * zwischendurch in Excel bearbeitet wurde, ließe sich dagegen nicht
 * zuverlässig machen.
 *
 * Grenzen, die der Browser vorgibt:
 *   * Nur Chrome und Edge am Computer. Firefox, Safari und Handys kennen die
 *     API nicht — dort bleibt es beim normalen Download.
 *   * Die Erlaubnis gilt pro Browser-Sitzung. Nach einem Neustart fragt der
 *     Browser beim ersten Export einmal kurz nach.
 *   * Die Seite kann nur in die Datei schreiben, die der Chef selbst
 *     ausgewählt hat — nirgendwo sonst hin.
 */

// Die API ist noch nicht in den TypeScript-Standardtypen. Hier nur das
// Stück, das tatsächlich benutzt wird.
interface WritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileHandle {
  name: string;
  createWritable(): Promise<WritableFileStream>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface SaveFilePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}

type WindowWithPicker = Window & {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<FileHandle>;
};

/** Wirft der Aufrufer weiter, wenn der Chef den Dateidialog abbricht — kein Fehler, nichts anzuzeigen. */
export class SaveCancelledError extends Error {
  constructor() {
    super('Speichern abgebrochen');
    this.name = 'SaveCancelledError';
  }
}

/** Die Datei ist gerade in Excel geöffnet — Windows sperrt sie dann gegen Schreiben. */
export class FileLockedError extends Error {
  constructor(fileName: string) {
    super(
      `"${fileName}" ist gerade in Excel geöffnet. Bitte die Datei schließen und den Export noch einmal starten.`
    );
    this.name = 'FileLockedError';
  }
}

export function supportsRememberedFile(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof (window as WindowWithPicker).showSaveFilePicker === 'function'
  );
}

// ------------------------------------------------------------ IndexedDB
// Minimaler Schlüssel-Wert-Speicher. Jeder Fehler hier ist harmlos: Ohne
// gemerkten Handle fragt der Export eben wieder nach der Datei.

const DB_NAME = 'translogpro-files';
const STORE = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readHandle(key: string): Promise<FileHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as FileHandle | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeHandle(key: string, handle: FileHandle | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const request = handle ? store.put(handle, key) : store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Nicht merken zu können ist kein Grund, den Export scheitern zu lassen.
  }
}

/** Name der gemerkten Datei, zum Anzeigen im Dashboard — null, wenn noch keine gewählt ist. */
export async function getRememberedFileName(key: string): Promise<string | null> {
  if (!supportsRememberedFile()) return null;
  return (await readHandle(key))?.name ?? null;
}

/** Vergisst die gewählte Datei; beim nächsten Export fragt der Browser wieder nach. */
export async function forgetRememberedFile(key: string): Promise<void> {
  await writeHandle(key, null);
}

// ------------------------------------------------------------ Speichern

interface SaveOptions {
  /** Unter welchem Schlüssel die Datei gemerkt wird, z. B. 'tankliste'. */
  key: string;
  suggestedName: string;
  mimeType: string;
  extension: string;
  description: string;
  /**
   * Erzeugt den Inhalt. Wird erst aufgerufen, NACHDEM Datei und Erlaubnis
   * feststehen — siehe den Kommentar zur Reihenfolge unten.
   */
  produce: () => Promise<Blob>;
  /** Andere Datei wählen, auch wenn schon eine gemerkt ist. */
  chooseNew?: boolean;
}

/**
 * Muss direkt aus einem Klick heraus aufgerufen werden.
 *
 * Die Reihenfolge ist nicht beliebig: Dateidialog und Erlaubnisabfrage darf
 * der Browser nur kurz nach einer Nutzeraktion zeigen. Der Export selbst
 * dauert einige Sekunden (Edge Function baut die Excel-Datei). Käme die
 * Erlaubnisabfrage erst danach, wäre dieses Zeitfenster vorbei und der
 * Browser lehnte ab. Deshalb: erst Datei und Erlaubnis klären, dann den
 * Inhalt erzeugen, dann schreiben.
 *
 * Gibt den Dateinamen zurück, in den geschrieben wurde.
 */
export async function saveToRememberedFile(options: SaveOptions): Promise<string> {
  const picker = (window as WindowWithPicker).showSaveFilePicker;
  if (!picker) throw new Error('Dieser Browser kann nicht direkt in eine Datei speichern.');

  let handle = options.chooseNew ? null : await readHandle(options.key);

  if (handle) {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'prompt') {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    // Abgelehnt: nicht stillschweigend woanders hinschreiben, sondern den
    // Chef neu wählen lassen.
    if (permission !== 'granted') handle = null;
  }

  if (!handle) {
    try {
      handle = await picker({
        suggestedName: options.suggestedName,
        types: [
          {
            description: options.description,
            accept: { [options.mimeType]: [options.extension] },
          },
        ],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SaveCancelledError();
      }
      throw error;
    }
    await writeHandle(options.key, handle);
  }

  const blob = await options.produce();

  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';

    // Windows sperrt eine in Excel geöffnete Datei. Chromium meldet das je
    // nach Version als eine dieser beiden Ausnahmen.
    if (name === 'NoModificationAllowedError' || name === 'InvalidStateError') {
      throw new FileLockedError(handle.name);
    }

    // Datei inzwischen verschoben oder gelöscht: Handle vergessen, damit der
    // nächste Export wieder nach dem Speicherort fragt.
    if (name === 'NotFoundError') {
      await writeHandle(options.key, null);
      throw new Error(
        `"${handle.name}" wurde nicht mehr gefunden — vermutlich verschoben oder gelöscht. Beim nächsten Export bitte den Speicherort neu wählen.`
      );
    }

    throw error;
  }

  return handle.name;
}
