import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateToIso, isoToGerman } from '@/lib/dateFormat';
import {
  getPickerlStatus,
  getServiceStatus,
  getVehicles,
  type Vehicle,
} from './licensePlateService';
import { getPermitStatus, getTrailers, type Trailer } from './trailerService';
import { type ExternalAccess, getExpiredAccesses } from './externalDriverAccessService';

/**
 * Alle Erinnerungen des Chefs an einer Stelle: der 🔔-Button im Header
 * zählt sie, app/chef/reminders.tsx listet sie, und das Dashboard zeigt
 * eine Erinnerung am ersten Tag, an dem sie da ist, zusätzlich als Hinweis.
 */
export type ReminderKind = 'service' | 'pickerl' | 'trailerPickerl' | 'permit' | 'expiredAccess';

/** Reihenfolge der Gruppen auf Dashboard und Erinnerungsseite. */
export const REMINDER_KINDS: ReminderKind[] = [
  'service',
  'pickerl',
  'trailerPickerl',
  'permit',
  'expiredAccess',
];

export interface Reminder {
  /**
   * Bleibt gleich, solange es um dieselbe Fälligkeit geht. Die Fälligkeit
   * steckt mit drin: Wird ein Pickerl quittiert und ist nächstes Jahr
   * wieder fällig, ist das eine neue Erinnerung mit neuem erstem Tag.
   */
  key: string;
  kind: ReminderKind;
  /** Was in der Liste steht, z. B. "GR400FX (01.11.2026)". */
  label: string;
  /** Nur bei expiredAccess — zum Verlängern oder Löschen. */
  access?: ExternalAccess;
}

export interface ReminderResult {
  reminders: Reminder[];
  /** false, wenn eine der Abfragen gescheitert ist — die Liste ist dann lückenhaft. */
  complete: boolean;
}

/**
 * Lädt alle Erinnerungen. Scheitert eine Abfrage, fehlen nur deren
 * Erinnerungen — eine Erinnerung ist kein Grund, alles andere scheitern
 * zu lassen.
 */
export async function getReminders(): Promise<ReminderResult> {
  let complete = true;
  const orEmpty = <T,>(promise: Promise<T[]>) =>
    promise.catch(() => {
      complete = false;
      return [] as T[];
    });

  const [vehicles, trailers, accesses] = await Promise.all([
    orEmpty<Vehicle>(getVehicles()),
    orEmpty<Trailer>(getTrailers()),
    orEmpty<ExternalAccess>(getExpiredAccesses()),
  ]);

  const reminders: Reminder[] = [];

  // Ausgeflottete LKW bleiben außen vor — die fahren nicht mehr.
  for (const vehicle of vehicles.filter((v) => v.retiredAt === null)) {
    const service = getServiceStatus(vehicle);
    if (service?.isDue) {
      reminders.push({
        key: `service:${vehicle.id}:${service.dueAtKm}`,
        kind: 'service',
        label: vehicle.plate,
      });
    }

    const pickerl = getPickerlStatus(vehicle.pickerlDueDate);
    if (pickerl?.isDue) {
      reminders.push({
        key: `pickerl:${vehicle.id}:${pickerl.dueDate}`,
        kind: 'pickerl',
        label: `${vehicle.plate} (${isoToGerman(pickerl.dueDate)})`,
      });
    }
  }

  for (const trailer of trailers) {
    const pickerl = getPickerlStatus(trailer.pickerlDueDate);
    if (pickerl?.isDue) {
      reminders.push({
        key: `trailerPickerl:${trailer.id}:${pickerl.dueDate}`,
        kind: 'trailerPickerl',
        label: `${trailer.plate} (${isoToGerman(pickerl.dueDate)})`,
      });
    }

    for (const permit of trailer.permits) {
      if (getPermitStatus(permit.validUntil)?.isDue) {
        reminders.push({
          key: `permit:${permit.id}:${permit.validUntil}`,
          kind: 'permit',
          // "GR123AB Deutschland (01.11.2026)"
          label: `${trailer.plate} ${permit.name} (${isoToGerman(permit.validUntil)})`,
        });
      }
    }
  }

  for (const access of accesses) {
    reminders.push({
      key: `access:${access.userId}:${access.expiresOn}`,
      kind: 'expiredAccess',
      label: `${access.label} (${access.username})`,
      access,
    });
  }

  return { reminders, complete };
}

// v2: Unter dem ersten Schlüssel hat die App beim allerersten Start alle
// schon offenen Erinnerungen als "heute neu" gespeichert. Der neue Schlüssel
// lässt sie noch einmal von vorn anfangen, diesmal mit der Grundlinie unten.
const FIRST_SEEN_STORAGE_KEY = 'reminders.firstSeen.v2';

/** Erster Tag für Erinnerungen, die es schon vor dem ersten Start gab. */
const KNOWN_BEFORE = '0000-00-00';

/**
 * Merkt sich für jede Erinnerung den Tag, an dem die App sie zum ersten Mal
 * gefunden hat, und gibt die zurück, deren erster Tag heute ist.
 *
 * Bewusst der erste Tag, an dem der Chef sie zu sehen bekommt, nicht das
 * Datum, ab dem sie fällig ist: Der Service hängt an Kilometern und hat gar
 * kein Datum, und eine Erinnerung von einem Tag, an dem der Chef die App
 * nicht offen hatte, käme sonst nie aufs Dashboard.
 *
 * Gespeichert am Gerät. Beim allerersten Start auf einem Gerät gelten alle
 * schon offenen Erinnerungen als bekannt; aufs Dashboard kommen erst die,
 * die danach dazukommen.
 */
export async function getNewToday(
  { reminders, complete }: ReminderResult,
  today: string = dateToIso(new Date())
): Promise<Set<string>> {
  let seen: Record<string, string> = {};
  try {
    const raw = await AsyncStorage.getItem(FIRST_SEEN_STORAGE_KEY);
    if (raw) {
      seen = JSON.parse(raw);
    } else {
      // Allererster Start an diesem Gerät: Was jetzt schon offen ist, hat
      // der Chef vorher längst gesehen (auf dem alten Dashboard oder einem
      // anderen Gerät) — das gehört hinter die Glocke, nicht aufs Dashboard.
      // Erst was danach dazukommt, ist neu.
      for (const reminder of reminders) {
        seen[reminder.key] = KNOWN_BEFORE;
      }
    }
  } catch {
    // Speicher nicht lesbar: alles gilt als heute neu — lieber einmal zu
    // oft auf dem Dashboard als nie.
  }

  // Erledigte Erinnerungen fliegen raus, damit der Speicher nicht wächst.
  // Nur bei vollständiger Liste: Sonst gälten die Erinnerungen einer
  // gerade gescheiterten Abfrage beim nächsten Mal wieder als neu.
  const next: Record<string, string> = complete ? {} : { ...seen };
  for (const reminder of reminders) {
    next[reminder.key] = seen[reminder.key] ?? today;
  }

  try {
    await AsyncStorage.setItem(FIRST_SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nicht gespeichert heißt nur: morgen nochmal auf dem Dashboard.
  }

  return new Set(reminders.filter((r) => next[r.key] === today).map((r) => r.key));
}
