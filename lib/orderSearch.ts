import { isoToGerman } from '@/lib/dateFormat';

/**
 * Suche in den Auftragslisten (app/chef/order/index.tsx,
 * app/chef/external-order/index.tsx).
 *
 * Mehrere Wörter müssen alle vorkommen, in beliebiger Reihenfolge und in
 * beliebigen Feldern: "voest leoben" findet einen Auftrag mit Ladestelle
 * "Voestalpine" und Entladestelle in Leoben. Groß/Klein und Akzente sind
 * egal ("Gulde" findet "Gülde"). Datumsfelder werden auch in der Schreibweise
 * "15.01.2026" durchsucht, so wie sie in der App stehen.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Bereitet die Suchwörter einmal auf — leer = keine Suche. */
export function parseSearch(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

/**
 * Passt der Auftrag zu allen Suchwörtern? `fields` sind die durchsuchbaren
 * Texte, `dates` ISO-Daten ('YYYY-MM-DD'), die zusätzlich deutsch
 * formatiert durchsucht werden.
 */
export function matchesSearch(
  words: string[],
  fields: (string | null | undefined)[],
  dates: (string | null | undefined)[] = []
): boolean {
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      ...fields,
      ...dates.filter((date): date is string => !!date).map((date) => `${date} ${isoToGerman(date)}`),
    ]
      .filter(Boolean)
      .join(' \u0000 ')
  );
  // Umlaute im Suchwort werden genauso umgeschrieben; "gulde" soll trotzdem
  // "Gülde" ("guelde") finden — also auch ohne das eingeschobene "e".
  const loose = haystack.replace(/(a|o|u)e/g, '$1');
  return words.every((word) => haystack.includes(word) || loose.includes(word.replace(/(a|o|u)e/g, '$1')));
}
