/**
 * Dates in the Fremdauftrag form are stored as plain ISO strings
 * ('YYYY-MM-DD') — the natural value for both an HTML <input type="date">
 * and @react-native-community/datetimepicker — and only reformatted to the
 * German "TT.MM.JJJJ" the paper template uses when rendering the PDF.
 * Times are stored as plain 24h "HH:MM" strings for the same reason,
 * matching <input type="time">.
 */

export function isoToGerman(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

// Built from local getters (not toISOString, which is UTC) so a date picked
// in the evening doesn't silently roll back a day for anyone west of UTC.
export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return date;
}

export function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// created_at/updated_at/completed_at sind volle Zeitstempel (timestamptz,
// also UTC), nicht die reinen ISO-Daten der Lade-/Entladespalten. Über den
// Umweg Date -> lokale Getter kommt der Tag heraus, den der Nutzer auch
// erlebt hat — ein einfaches slice(0, 10) auf den UTC-String läge abends
// einen Tag daneben.
export function timestampToGermanDate(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return isoToGerman(dateToIso(parsed));
}

export function timestampToGerman(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return `${isoToGerman(dateToIso(parsed))}, ${dateToTimeString(parsed)} Uhr`;
}
