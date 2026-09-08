import { createCompanyDirectory } from '@/app/services/companyDirectory';

/**
 * Backs the "An Firma" combobox on the Fremdauftrag form: a dropdown of
 * carrier companies used before, plus the option to just type a new one.
 * Table: supabase/migrations/20260907120000_create_carrier_companies.sql
 */
const carrierCompanies = createCompanyDirectory('carrier_companies');

export const getCarrierCompanies = carrierCompanies.getAll;
export const addCarrierCompanyIfNew = carrierCompanies.addIfNew;
