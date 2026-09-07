// Fallback-Login für den Fall, dass Supabase gar nicht erreichbar ist —
// pausiertes Free-Tier-Projekt, Ausfall, oder schlicht kein Netz. Damit
// bleibt die App vorführbar: die Dashboards arbeiten ohnehin mit lokalen
// Daten (siehe app/services/orderService.ts), nur die Fahrerverwaltung
// braucht wirklich das Backend.
//
// Bewusste Grenzen dieses Mechanismus — bitte beim Ändern beibehalten:
//
//  * Er greift AUSSCHLIESSLICH, wenn die Anfrage Supabase nie erreicht hat.
//    Antwortet der Server "falsches Passwort", bleibt es beim Fehler. Sonst
//    wäre das eine Hintertür am laufenden Login vorbei.
//
//  * Er ist standardmäßig AUS. Ohne gesetztes Passwort unten passiert nichts.
//
//  * Das Passwort ist KEIN Geheimnis. EXPO_PUBLIC_*-Werte werden beim Build
//    ins ausgelieferte JS-Bundle eingebacken und sind für jeden lesbar, der
//    hineinschaut. Das hier ist ein Demo-Schalter, keine Zugangskontrolle.
//
//  * Privilegierte Aktionen bleiben trotzdem gesperrt: die Edge Functions
//    prüfen das JWT serverseitig (supabase/functions/_shared/verify-boss.ts).
//    Im Offline-Modus gibt es keins, also schlägt die Fahrerverwaltung fehl —
//    unabhängig davon, was der Client über sich behauptet.

export type OfflineUserRole = "boss" | "driver";

export interface OfflineUser {
  id: string;
  role: OfflineUserRole;
  name: string;
  username: string;
}

// Das Setzen dieses Passworts aktiviert den Fallback. Nicht gesetzt = aus.
const FALLBACK_PASSWORD = process.env.EXPO_PUBLIC_OFFLINE_FALLBACK_PASSWORD;
const FALLBACK_USERNAME =
  process.env.EXPO_PUBLIC_OFFLINE_FALLBACK_USERNAME ?? "boss";
const FALLBACK_ROLE: OfflineUserRole =
  process.env.EXPO_PUBLIC_OFFLINE_FALLBACK_ROLE === "driver" ? "driver" : "boss";

export function isOfflineFallbackConfigured(): boolean {
  return typeof FALLBACK_PASSWORD === "string" && FALLBACK_PASSWORD.length > 0;
}

export function matchesOfflineFallback(
  username: string,
  password: string
): boolean {
  if (!isOfflineFallbackConfigured()) return false;

  return (
    username.trim().toLowerCase() === FALLBACK_USERNAME.trim().toLowerCase() &&
    password === FALLBACK_PASSWORD
  );
}

// Die id ist bewusst kein UUID-Format: sie taucht in lokalen Zuordnungen auf
// (orderService.createdBy) und soll in Daten sofort als Offline-Sitzung
// erkennbar sein, statt sich als echter Supabase-Account zu tarnen.
export function buildOfflineUser(): OfflineUser {
  return {
    id: "offline-fallback-user",
    role: FALLBACK_ROLE,
    name: FALLBACK_USERNAME,
    username: FALLBACK_USERNAME,
  };
}
