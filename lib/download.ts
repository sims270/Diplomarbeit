import { Linking, Platform } from 'react-native';

/**
 * Öffnet eine (signierte) Download-URL.
 *
 * Im Web bewusst über location.href statt window.open: die URL trägt ein
 * Content-Disposition: attachment, der Browser lädt also herunter und
 * bleibt auf der Seite — und im Gegensatz zu window.open läuft das nicht in
 * den Popup-Blocker, auch wenn davor auf die signierte URL gewartet wurde
 * (vgl. den Popup-Hinweis in lib/ownOrderExport.ts).
 */
export async function openDownloadUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.href = url;
    return;
  }

  await Linking.openURL(url);
}
