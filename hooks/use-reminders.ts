import { useSyncExternalStore } from 'react';
import {
  getNewToday,
  getReminders,
  type Reminder,
} from '@/app/services/reminderService';

interface RemindersState {
  reminders: Reminder[];
  /** Keys der Erinnerungen, deren erster Tag heute ist. */
  newToday: Set<string>;
  loaded: boolean;
}

// Ein gemeinsamer Stand für Header, Dashboard und Erinnerungsseite: Der
// Header sitzt auf jedem Chef-Screen, und jeder davon soll nicht selbst
// LKW, Auflieger und Zugänge nachladen.
let state: RemindersState = { reminders: [], newToday: new Set(), loaded: false };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/** Lädt die Erinnerungen neu; laufen schon welche, wird darauf gewartet. */
export function refreshReminders(): Promise<void> {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const result = await getReminders();
        const newToday = await getNewToday(result);
        state = { reminders: result.reminders, newToday, loaded: true };
        listeners.forEach((listener) => listener());
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}

export function useReminders(): RemindersState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
