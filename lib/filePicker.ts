import { ACCEPTED_MIME_TYPES, type PickedFile } from './filePickerShared';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Auswahl einer Datei (CMR-Scan als PDF oder Foto) — native Variante.
 * Das Web-Gegenstück steht in filePicker.web.ts und kommt ohne
 * expo-document-picker aus, weil der Browser mit <input type="file"> schon
 * alles mitbringt.
 */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_MIME_TYPES,
    // Ohne die Kopie in den Cache zeigt die uri je nach Plattform auf einen
    // Content-Provider, den fetch() beim Upload nicht mehr lesen darf.
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  return {
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    uri: asset.uri,
  };
}
