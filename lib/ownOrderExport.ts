import type { Order } from '@/app/services/orderService';
import { buildOwnOrderHtml } from '@/lib/ownOrderPdf';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * expo-print's web implementation (ExponentPrint.web.ts) ignores the `html`
 * option entirely and just calls window.print() on whatever page is
 * currently open — so on web we bypass expo-print and open the document in
 * its own window/tab, then print *that*. Same approach as
 * transportauftragExport.ts.
 *
 * Must be called with as little async work ahead of it as possible: once a
 * browser's "recent user gesture" allowance for window.open lapses, the
 * popup gets silently blocked.
 */
function printHtmlInNewWindow(html: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error(
      'Pop-up wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben und erneut versuchen.'
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;

  // Give the new document a moment to finish layout before printing.
  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

/**
 * Renders the order to PDF and hands it to the platform's share/print sheet.
 */
export async function exportOwnOrderPdf(order: Order, driverUsername?: string): Promise<void> {
  const html = buildOwnOrderHtml(order, driverUsername);

  if (Platform.OS === 'web') {
    printHtmlInNewWindow(html, `Transportauftrag Nr. ${order.orderNr}`);
    return;
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
}
