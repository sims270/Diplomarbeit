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

export function createCompanyDirectory(table: string): CompanyDirectory {
  return {
    async getAll() {
      const { data, error } = await supabase.from(table).select('name').order('name');

      if (error) {
        console.warn(`[companyDirectory:${table}] could not load companies:`, error.message);
        return [];
      }

      return data.map((row) => row.name as string);
    },

    async addIfNew(name: string) {
      const trimmed = name.trim();
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
