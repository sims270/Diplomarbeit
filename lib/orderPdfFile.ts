import { htmlToPdfBlob } from '@/lib/htmlToPdf';
import {
  SaveCancelledError,
  saveToRememberedFolder,
  supportsRememberedFolder,
} from '@/lib/rememberedFile';

/**
 * Speichert die PDF eines Auftrags (eigener Auftrag oder Fremdauftrag) im
 * Web — in den Auftrags-Ordner, den der Chef auf diesem Laptop gewählt hat
 * (lib/rememberedFile.ts), sonst als normaler Download.
 *
 * Alle Auftrags-PDFs liegen im selben Ordner. Wird ein Auftrag geändert und
 * neu exportiert, überschreibt die neue PDF die alte gleichen Namens.
 */

/** Schlüssel für den gemerkten Ordner, siehe getRememberedFolderName. */
export const ORDER_PDF_FOLDER_KEY = 'auftraege-pdf';

export interface SavedPdf {
  savedTo: 'folder' | 'download';
  fileName: string;
  /** Nur bei savedTo 'folder'. */
  folderName?: string;
}

/**
 * "Transportauftrag_Nr_123.pdf" für Fremdaufträge, "Auftrag_Nr_123.pdf" für
 * eigene — beide liegen im selben Ordner und dürfen sich nicht
 * überschreiben, auch wenn die Nummern gleich sind.
 */
export function orderPdfFileName(kind: 'external' | 'own', orderNr: string): string {
  // Zeichen, die Windows in Dateinamen nicht erlaubt, durch "-" ersetzen.
  const nr = orderNr.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'ohne-Nummer';
  return `${kind === 'external' ? 'Transportauftrag' : 'Auftrag'}_Nr_${nr}.pdf`;
}

/**
 * Meldung für den Chef, wohin die PDF gegangen ist. Die beiden Vorlagen
 * kommen aus den Übersetzungen (orderPdf.savedToFolder / downloaded).
 */
export function describeSavedPdf(
  saved: SavedPdf,
  folderTemplate: string,
  downloadTemplate: string
): string {
  return saved.savedTo === 'folder'
    ? folderTemplate.replace('{folder}', saved.folderName ?? '').replace('{file}', saved.fileName)
    : downloadTemplate.replace('{file}', saved.fileName);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Erst im nächsten Tick freigeben, Safari bricht den Download sonst ab.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Möglichst direkt aus dem Klick heraus aufrufen: Beim ersten Mal zeigt der
 * Browser den Ordner-Dialog, und das erlaubt er nur kurz nach einer
 * Nutzeraktion.
 */
export async function saveOrderPdf(html: string, fileName: string): Promise<SavedPdf> {
  const produce = () => htmlToPdfBlob(html);

  if (supportsRememberedFolder()) {
    try {
      const saved = await saveToRememberedFolder({ key: ORDER_PDF_FOLDER_KEY, fileName, produce });
      return { savedTo: 'folder', ...saved };
    } catch (error) {
      // Ordner-Dialog weggeklickt, oder der Browser verweigert ihn, weil der
      // Klick schon zu lange her ist: Die PDF soll trotzdem nicht verloren
      // gehen, dann eben in "Downloads". Andere Fehler (Datei gesperrt,
      // Ordner weg) muss der Chef sehen.
      const name = error instanceof DOMException ? error.name : '';
      if (
        !(error instanceof SaveCancelledError) &&
        name !== 'SecurityError' &&
        name !== 'NotAllowedError'
      ) {
        throw error;
      }
    }
  }

  downloadBlob(await produce(), fileName);
  return { savedTo: 'download', fileName };
}
