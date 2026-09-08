import { createCompanyDirectory } from '@/app/services/companyDirectory';

/**
 * Backs the "Firma" combobox at Ladestelle/Entladestelle on the
 * Fremdauftrag form: a dropdown of loading/unloading site companies used
 * before, plus the option to just type a new one. Both directions share one
 * list since the same customer site can be an origin in one order and a
 * destination in another.
 * Table: supabase/migrations/20260907130000_create_site_companies.sql
 */
const siteCompanies = createCompanyDirectory('site_companies');

export const getSiteCompanies = siteCompanies.getAll;
export const addSiteCompanyIfNew = siteCompanies.addIfNew;
