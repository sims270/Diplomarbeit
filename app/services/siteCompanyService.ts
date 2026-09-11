import { companyKey, normalizeCompanyName } from '@/app/services/companyDirectory';
import { formatCompanyAddress, type AddressRow } from '@/app/services/companyAddress';
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

/**
 * Was im Dropdown steht: "voestalpine Stahl GmbH — voestalpine-Straße 3,
 * A-4020 Linz". Die Adresse gehört sichtbar dazu, weil dieselbe Firma
 * mehrere Standorte haben kann — ohne sie stünden mehrere Zeilen da, die
 * gleich aussehen und Verschiedenes bedeuten.
 */
export function formatSiteCompany(company: SiteCompany): string {
  return company.address ? `${company.name} — ${company.address}` : company.name;
}

/**
 * Merkt einen frisch eingetippten Standort für das nächste Mal.
 *
 * Eigene Implementierung statt createCompanyDirectory: Dort ist der Name
 * die Identität, hier ist es Name + Anschrift. Eine Firma mit einem
 * zweiten Werk darf ein zweites Mal in die Tabelle — nur derselbe Standort
 * nicht noch einmal.
 *
 * Fehlschläge werden geschluckt wie im companyDirectory: Das Anlegen eines
 * Auftrags darf daran nie scheitern, die Firma lässt sich immer auch frei
 * eintippen.
 */
export async function addSiteCompanyIfNew(name: string, address = ''): Promise<void> {
  const cleanName = normalizeCompanyName(name);
  if (!cleanName) return;

  // Kein upsert: Sein Konfliktziel wäre das UNIQUE auf name allein, und
  // genau das entfällt mit 20260911140000 — es verbot der Firma das zweite
  // Werk. Stattdessen nachsehen und nur anlegen, was fehlt.
  const { data, error: readError } = await supabase
    .from('site_companies')
    .select('name, strasse, plz, ort');

  if (readError) {
    console.warn('[siteCompanyService] could not check companies:', readError.message);
    return;
  }

  const wanted = `${companyKey(cleanName)}|${companyKey(address)}`;
  const exists = data.some(
    (row) =>
      `${companyKey(row.name as string)}|${companyKey(formatCompanyAddress(row as AddressRow))}` ===
      wanted
  );
  if (exists) return;

  const { error } = await supabase
    .from('site_companies')
    .insert({ name: cleanName, strasse: normalizeCompanyName(address) || null });

  if (error) {
    console.warn('[siteCompanyService] could not save company:', error.message);
  }
}

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

  const companies = data.map((row) => ({
    name: row.name as string,
    address: formatCompanyAddress(row as AddressRow),
  }));

  // Ein Standort, nicht eine Firma: Dieselbe Firma kommt mehrfach vor, wenn
  // sie mehrere Lade-/Entladestellen hat — verschiedene Werke, verschiedene
  // Straßen. Die gehören alle ins Dropdown, sonst fehlt dem Chef genau die
  // Adresse, die er braucht.
  //
  // Zusammengelegt wird deshalb nur, was in Name UND Adresse übereinstimmt
  // und sich bloß in Schreibweise oder Leerzeichen unterscheidet. Solche
  // Zeilen sind echte Dubletten (typisch aus dem Import) — zwei Standorte
  // sind sie nie, denn dann wäre die Adresse eine andere.
  const seen = new Set<string>();
  return companies.filter((company) => {
    const key = `${companyKey(company.name)}|${companyKey(company.address)}`;
    if (!companyKey(company.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
