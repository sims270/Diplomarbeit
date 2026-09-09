import type { PickedFile } from '@/lib/filePickerShared';
import { supabase } from '@/lib/supabase';

/**
 * CMR-Frachtbriefe und Fotos, die der Fahrer zu einem Auftrag hochlädt.
 *
 * Die Dateien liegen im privaten Bucket "order-documents", ein Ordner je
 * Auftrag (siehe supabase/migrations/20260908120000_order_documents.sql).
 * Wer was sehen darf, entscheiden die Storage-Policies anhand dieses
 * Ordnernamens — der Chef zum Beispiel erst, wenn der Auftrag den Status
 * 'completed' hat. Die Oberfläche blendet dieselbe Regel nur zusätzlich
 * ein; verlassen muss sie sich darauf nicht.
 */
const BUCKET = 'order-documents';

export interface OrderDocument {
  /** Voller Pfad im Bucket, z. B. "3f0c…/1757325600000-cmr.pdf" */
  path: string;
  /** Anzeigename, ohne den technischen Zeitstempel davor */
  fileName: string;
  sizeInBytes: number;
  uploadedAt: string;
}

// Storage-Schlüssel vertragen keine Umlaute, Leerzeichen oder Slashes —
// alles andere als das hier würde entweder abgelehnt oder verschöbe die
// Datei in einen Unterordner und damit an den Policies vorbei.
function toStorageName(fileName: string): string {
  const cleaned = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return cleaned || 'datei';
}

// Gegenstück dazu: der Zeitstempel hält gleichnamige Uploads auseinander,
// im Auftrag angezeigt wird aber der Name, den der Fahrer kennt.
function stripTimestamp(storageName: string): string {
  return storageName.replace(/^\d+-/, '');
}

export async function listOrderDocuments(orderId: string): Promise<OrderDocument[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(orderId, {
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw new Error(error.message);

  return (data ?? [])
    // Supabase legt in leeren Ordnern einen Platzhalter ohne id ab.
    .filter((entry) => entry.id)
    .map((entry) => ({
      path: `${orderId}/${entry.name}`,
      fileName: stripTimestamp(entry.name),
      sizeInBytes: entry.metadata?.size ?? 0,
      uploadedAt: entry.created_at ?? '',
    }));
}

// Im Web liefert der Picker das File-Objekt gleich mit; nativ steht dort
// eine file://-URL, deren Inhalt fetch() als Blob zurückgibt.
async function toUploadBody(file: PickedFile): Promise<Blob> {
  if (file.file) return file.file;
  return await (await fetch(file.uri)).blob();
}

export async function uploadOrderDocument(orderId: string, file: PickedFile): Promise<void> {
  const path = `${orderId}/${Date.now()}-${toStorageName(file.name)}`;
  const body = await toUploadBody(file);

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: file.mimeType || 'application/octet-stream',
    upsert: false,
  });

  if (error) throw new Error(error.message);
}

/**
 * Der Bucket ist privat, es gibt also keine dauerhafte URL. Die signierte
 * URL gilt fünf Minuten und trägt dank `download` ein
 * Content-Disposition: attachment — der Browser lädt die Datei damit
 * herunter, statt sie im Tab zu öffnen.
 */
export async function getOrderDocumentDownloadUrl(document: OrderDocument): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.path, 300, { download: document.fileName });

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteOrderDocument(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) throw new Error(error.message);

  // remove() meldet keinen Fehler, wenn eine Policy den Zugriff verweigert —
  // die Antwort bleibt dann einfach leer. Ohne diese Prüfung sähe der Fahrer
  // eine Erfolgsmeldung für etwas, das nie passiert ist.
  if (!data || data.length === 0) {
    throw new Error('Datei konnte nicht gelöscht werden.');
  }
}
