import { dateToIso } from '@/lib/dateFormat';
import { formatMonth, shiftMonth } from '@/lib/month';

/**
 * Der Zeitraum der Auftragsansichten als Text, damit er auch als URL-Parameter
 * von den Dashboard-Kacheln in die Auftragsliste passt:
 * 'today', 'YYYY-MM' (Monat), 'YYYY' (Jahr) oder 'all'.
 */
export type PeriodKind = 'today' | 'month' | 'year' | 'all';

export const TODAY_PERIOD = 'today';
export const ALL_PERIOD = 'all';

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

export const currentYear = () => String(new Date().getFullYear());

export function isOrderPeriod(value: string | undefined): value is string {
  return (
    value === TODAY_PERIOD ||
    value === ALL_PERIOD ||
    (!!value && (MONTH_PATTERN.test(value) || YEAR_PATTERN.test(value)))
  );
}

export function periodKind(period: string): PeriodKind {
  if (period === TODAY_PERIOD) return 'today';
  if (period === ALL_PERIOD) return 'all';
  return YEAR_PATTERN.test(period) ? 'year' : 'month';
}

/**
 * Liegt ein ISO-Datum im Zeitraum? Ohne Datum steht ein Eintrag bei Monat und
 * Jahr immer, damit er nirgends verloren geht.
 */
export function isDateInPeriod(isoDate: string, period: string): boolean {
  if (period === ALL_PERIOD) return true;
  if (period === TODAY_PERIOD) return isoDate === dateToIso(new Date());
  return !isoDate || isoDate.startsWith(period);
}

/**
 * Heute zählt jeder Auftrag, der heute geladen oder entladen wird. Für Monat
 * und Jahr gilt das Ladedatum, sonst das Entladedatum.
 */
export function isOrderInPeriod(
  order: { loadingDate: string; unloadingDate: string },
  period: string
): boolean {
  if (period === TODAY_PERIOD) {
    return (
      isDateInPeriod(order.loadingDate, period) || isDateInPeriod(order.unloadingDate, period)
    );
  }
  return isDateInPeriod(order.loadingDate || order.unloadingDate, period);
}

/** Einen Monat oder ein Jahr vor oder zurück. */
export function shiftPeriod(period: string, delta: number): string {
  return periodKind(period) === 'year'
    ? String(Number(period) + delta)
    : shiftMonth(period, delta);
}

/** "November 2026" oder "2026". */
export function formatPeriod(period: string, language: string): string {
  return periodKind(period) === 'month' ? formatMonth(period, language) : period;
}
