import type { Order } from '@/app/services/orderService';
import { orderPdfFileName, saveOrderPdf, type SavedPdf } from '@/lib/orderPdfFile';
import { buildOwnOrderHtml } from '@/lib/ownOrderPdf';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Erzeugt die PDF eines eigenen Auftrags — gleich wie
 * lib/transportauftragExport.ts: im Web in den Auftrags-Ordner dieses
 * Laptops (sonst Download), am Handy über das Teilen-Menü.
 */
export async function exportOwnOrderPdf(
  order: Order,
  driverUsername?: string
): Promise<SavedPdf | null> {
  const html = buildOwnOrderHtml(order, driverUsername);

  if (Platform.OS === 'web') {
    return saveOrderPdf(html, orderPdfFileName('own', order.orderNr));
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
