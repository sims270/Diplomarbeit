import { supabase } from '@/lib/supabase';

/**
 * Shared backing for the "pick from a growing list, or just type a new
 * name" comboboxes on the Fremdauftrag form (carrier company, loading/
 * unloading site company). Both calls fail soft (empty list / silently
 * skipped insert) so a missing table or unreachable Supabase never blocks
 * creating the order itself — free text always still works.
 */
export interface CompanyDirectory {
  getAll(): Promise<string[]>;
  addIfNew(name: string): Promise<void>;
}

/**
 * "  voestalpine   Stahl  GmbH " → "voestalpine Stahl GmbH".
 *
 * Die Tabellen haben zwar ein UNIQUE auf name, das greift aber nur bei
 * exakter Gleichheit: Ein zusätzliches Leerzeichen oder ein geschütztes
 * Leerzeichen (U+00A0, kommt beim Import aus dem Warenwirtschaftssystem
 * vor) macht daraus eine zweite Firma. Im Dropdown steht sie dann doppelt,
 * in der Supabase-Tabelle sieht sie gleich aus.
 */
export function normalizeCompanyName(name: string): string {
  return name.replace(/[\s ]+/g, ' ').trim();
}

/** Vergleichsschlüssel: zusätzlich ohne Groß-/Kleinschreibung. */
export function companyKey(name: string): string {
  return normalizeCompanyName(name).toLowerCase();
}

/**
 * Entfernt Firmen, die sich nur in Schreibweise oder Leerzeichen
 * unterscheiden. Die erste gewinnt — die Listen kommen nach name sortiert
 * aus der Datenbank, damit ist die Auswahl stabil und nicht zufällig.
 *
 * Der Riegel gehört zusätzlich in die Datenbank (siehe
 * supabase/migrations/20260911140000_dedupe_company_names.sql); hier steht
 * er, damit eine noch nicht bereinigte Tabelle nicht im Dropdown durchschlägt.
 */
export function dedupeByName<T>(items: T[], nameOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = companyKey(nameOf(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createCompanyDirectory(table: string): CompanyDirectory {
  return {
    async getAll() {
      const { data, error } = await supabase.from(table).select('name').order('name');

      if (error) {
        console.warn(`[companyDirectory:${table}] could not load companies:`, error.message);
        return [];
      }

      return dedupeByName(
        data.map((row) => row.name as string),
        (name) => name
      );
    },

    async addIfNew(name: string) {
      const trimmed = normalizeCompanyName(name);
      if (!trimmed) return;

      const { error } = await supabase
        .from(table)
        .upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true });

      if (error) {
        console.warn(`[companyDirectory:${table}] could not save company:`, error.message);
      }
    },
  };
}
