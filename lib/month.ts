/**
 * Monate als 'YYYY-MM' — so lassen sie sich direkt mit den ISO-Daten der
 * Einträge vergleichen (isoDate.startsWith(month)) und untereinander als
 * Text sortieren. Genutzt von der Monatsauswahl (components/MonthPicker.tsx).
 */

const toMonth = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Der laufende Monat — die Vorgabe jeder Monatsauswahl. */
export const currentMonth = () => toMonth(new Date());

export const shiftMonth = (month: string, delta: number) => {
  const [year, monthNr] = month.split('-').map(Number);
  return toMonth(new Date(year, monthNr - 1 + delta, 1));
};

export const formatMonth = (month: string, language: string) => {
  const [year, monthNr] = month.split('-').map(Number);
  return new Date(year, monthNr - 1, 1).toLocaleDateString(
    language === 'en' ? 'en-GB' : 'de-DE',
    { month: 'long', year: 'numeric' }
  );
};

/**
 * Gehört ein ISO-Datum zum Monat? Ohne Datum: ja — ein Eintrag, der sich
 * keinem Monat zuordnen lässt, soll in jedem stehen statt in keinem.
 */
export const isInMonth = (isoDate: string, month: string) =>
  !isoDate || isoDate.startsWith(month);
