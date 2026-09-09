import { ACCEPTED_MIME_TYPES, type PickedFile } from './filePickerShared';

/**
 * Web-Variante der Dateiauswahl. Im Browser genügt ein kurzlebiges
 * <input type="file">, deshalb kommt dieser Pfad ohne expo-document-picker
 * aus. Metro nimmt diese Datei automatisch statt filePicker.ts, sobald für
 * Web gebaut wird — dasselbe Muster wie bei DateField.web.tsx.
 */
export async function pickFile(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_MIME_TYPES.join(',');
    input.style.display = 'none';
    document.body.appendChild(input);

    const finish = (picked: PickedFile | null) => {
      input.remove();
      resolve(picked);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      finish(
        file
          ? {
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              uri: '',
              file,
            }
          : null
      );
    });

    // Bricht der Nutzer den Dialog ab, feuert 'change' nicht. Dafür gibt es
    // 'cancel'; wo der Browser das noch nicht kennt, bleibt das Promise
    // offen — sichtbar passiert dann schlicht nichts.
    input.addEventListener('cancel', () => finish(null));

    input.click();
  });
}
