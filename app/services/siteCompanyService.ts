import { createCompanyDirectory } from '@/app/services/companyDirectory';
import { supabase } from '@/lib/supabase';

/**
 * Backs the "Firma" combobox at Ladestelle/Entladestelle on the Auftrags-
 * und Fremdauftragsformular: a dropdown of loading/unloading site companies
 * used before, plus the option to just type a new one. Both directions share
 * one list since the same customer site can be an origin in one order and a
 * destination in another.
 * Table: supabase/migrations/20260907130000_create_site_companies.sql
 */
export interface SiteCompany {
  name: string;
  /** Vollständige Anschrift "Straße, A-PLZ Ort" — fertig für das Adressfeld des Formulars, leer wenn zur Firma nichts hinterlegt ist. */
  address: string;
}

const siteCompanies = createCompanyDirectory('site_companies');

export const addSiteCompanyIfNew = siteCompanies.addIfNew;

/**
 * Fails soft (empty list) like the rest of the company directory: eine
 * fehlende Tabelle oder ein nicht erreichbares Supabase darf das Anlegen
 * eines Auftrags nie blockieren — die Firma lässt sich immer auch frei
 * eintippen.
 */
export async function getSiteCompanies(): Promise<SiteCompany[]> {
  const { data, error } = await supabase
    .from('site_companies')
    .select('name, strasse, plz, ort')
    .order('name');

  if (error) {
    console.warn('[siteCompanyService] could not load companies:', error.message);
    return [];
  }

  return data.map((row) => ({
    name: row.name as string,
    address: formatAddress(row as SiteCompanyRow),
  }));
}

interface SiteCompanyRow {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
}

/**
 * "voestalpine-Straße 3, A-4020 Linz". Fehlt ein Teil in der Tabelle, fällt
 * er samt Trennzeichen weg, statt eine Lücke oder einen losen Beistrich zu
 * hinterlassen.
 */
function formatAddress({ strasse, plz, ort }: SiteCompanyRow): string {
  const postcode = plz?.trim();
  const town = [postcode && withCountryCode(postcode), ort?.trim()].filter(Boolean).join(' ');
  return [strasse?.trim(), town].filter(Boolean).join(', ');
}

/**
 * Österreichische Schreibweise mit Länderkürzel vor der Postleitzahl. Ein
 * Land steht nicht in der Tabelle, das Kürzel ist deshalb fix "A-" — eine
 * PLZ, die schon eines mitbringt (etwa "D-80331" bei einer deutschen
 * Firma), bleibt unangetastet.
 */
function withCountryCode(postcode: string): string {
  return /^[A-Za-z]{1,3}-/.test(postcode) ? postcode : `A-${postcode}`;
}
