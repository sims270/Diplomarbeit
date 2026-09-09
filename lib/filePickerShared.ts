/**
 * Typ und Konstante der Dateiauswahl — bewusst in einer eigenen Datei ohne
 * .web-Variante.
 *
 * Stünden sie in filePicker.ts, käme das Web nicht daran: ein
 * `import ... from './filePicker'` innerhalb von filePicker.web.ts löst
 * Metro erneut auf die .web-Datei auf, die Datei importiert also sich
 * selbst und die Konstante bleibt undefined.
 */
export interface PickedFile {
  name: string;
  mimeType: string;
  /** file://-URL auf nativen Plattformen, im Web leer. */
  uri: string;
  /** Nur im Web gesetzt: dort liegt der Inhalt direkt als File-Objekt vor. */
  file?: Blob;
}

export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/*'];
