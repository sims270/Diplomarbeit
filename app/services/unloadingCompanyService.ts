import { createCompanyDirectory } from '@/app/services/companyDirectory';

/**
 * Backs the "Firma" combobox at Entladung on both order forms (Auftrag und
 * Fremdauftrag). Eigene Liste, getrennt von site_companies: dort stehen die
 * importierten Kundenfirmen samt Adresse für die Ladestelle, an der
 * Entladestelle kommen andere Firmen vor. Diese Liste startet leer und
 * wächst von selbst — eine frei eingetippte Entladefirma steht beim
 * nächsten Auftrag im Dropdown.
 * Table: supabase/migrations/20260910110000_create_unloading_companies.sql
 */
const unloadingCompanies = createCompanyDirectory('unloading_companies');

export const getUnloadingCompanies = unloadingCompanies.getAll;
export const addUnloadingCompanyIfNew = unloadingCompanies.addIfNew;
