import type { ExternalOrder } from '@/app/services/externalOrderService';
import { orderPdfFileName, saveOrderPdf, type SavedPdf } from '@/lib/orderPdfFile';
import { buildTransportauftragHtml } from '@/lib/transportauftragPdf';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Erzeugt die PDF des Transportauftrags.
 *
 * Web: als Datei in den Auftrags-Ordner dieses Laptops (lib/orderPdfFile.ts),
 * sonst als Download. Gibt zurück, wohin gespeichert wurde, damit der
 * Bildschirm es anzeigen kann. Drucken geht dann aus dem PDF-Programm.
 *
 * Handy: wie bisher über das Teilen-Menü des Geräts; Rückgabe null.
 *
 * Möglichst direkt nach dem Klick aufrufen — beim ersten Mal fragt der
 * Browser nach dem Ordner, und das nur kurz nach einer Nutzeraktion.
 */
export async function exportTransportauftragPdf(order: ExternalOrder): Promise<SavedPdf | null> {
  const html = buildTransportauftragHtml(order);

  if (Platform.OS === 'web') {
    return saveOrderPdf(html, orderPdfFileName('external', order.orderNr));
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Transportauftrag Nr. ${order.orderNr}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
  return null;
}
