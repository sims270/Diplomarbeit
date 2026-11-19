import { Linking, Platform } from 'react-native';

/**
 * Öffnet eine neue, ausgefüllte Mail im Standard-Mailprogramm — im Büro
 * Outlook 2019. Über mailto, damit die App kein Mail-Passwort kennen muss:
 * Der Chef trägt nur den Empfänger ein und schickt sie selbst ab, sie liegt
 * danach ganz normal unter "Gesendet".
 *
 * Gibt false zurück, wenn kein Mailprogramm die Adresse annimmt (nur nativ
 * erkennbar; im Browser übernimmt Windows bzw. das System die Weiterleitung).
 */
export async function openEmailDraft(subject: string, body: string): Promise<boolean> {
  // Outlook erwartet Zeilenumbrüche als CRLF, sonst steht alles in einer Zeile.
  const url =
    `mailto:?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`;

  if (Platform.OS === 'web') {
    // Linking.openURL öffnet im Web einen neuen Tab, der bei mailto leer
    // stehen bliebe. So übernimmt direkt das Mailprogramm.
    window.location.href = url;
    return true;
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Adresse der Anmeldeseite für die Mail an den fremden Fahrer — im Web die
 * Domain, unter der der Chef die App gerade nutzt. Nativ gibt es keine, dann
 * fehlt die Zeile.
 */
export function loginUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return `${window.location.origin}/login`;
}
