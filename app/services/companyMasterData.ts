import { normalizeCompanyName } from '@/app/services/companyDirectory';
import { formatCompanyAddress } from '@/app/services/companyAddress';
import { supabase } from '@/lib/supabase';

/**
 * Neue Firma mit allen Stammdaten anlegen — aus der Auswahlliste im Auftrag
 * ("Neue Firma anlegen", components/NewCompanyModal.tsx).
 *
 *   * Kunden (Auftraggeber, Ladestelle) → site_companies, mit UID und
 *     BMD-Konto (beides freiwillig)
 *   * Subunternehmer (Frächter, "An Firma") → carrier_companies, nur Name
 *     und Anschrift — UID und BMD-Konto braucht es dort nicht
 *
 * Solange BMD nicht mit der App verbunden ist, kommen Kundennummer und UID
 * nur so oder von Hand in Supabase in die Tabelle. Die Rechnung holt sie sich
 * dann selbst über den Namen (export-invoice, loadCustomer).
 */
export type CompanyTable = 'site_companies' | 'carrier_companies';

export interface NewCompany {
  name: string;
  strasse: string;
  /** Länderkürzel wie auf der Rechnung: "A", "D", "I", … — leer = Österreich. */
  land: string;
  plz: string;
  ort: string;
  /** Freiwillig. */
  uidNummer: string;
  /** Freiwillig — die Kontonummer aus BMD, daraus wird die Kundennummer. */
  bmdKtoNr: string;
}

/**
 * PLZ so, wie sie in der Tabelle steht: Österreich ohne Kürzel (die App
 * setzt "A-" selbst davor, siehe companyAddress.ts), Ausland mit Kürzel
 * ("D-59174"). Steht das Kürzel schon in der PLZ, bleibt sie, wie sie ist.
 */
function storedPostcode(land: string, plz: string): string {
  const code = land.trim().toUpperCase().replace(/-$/, '');
  const postcode = plz.trim();
  if (!postcode) return '';
  if (/^[A-Za-z]{1,3}-/.test(postcode)) return postcode;
  if (!code || code === 'A' || code === 'AT') return postcode;
  return `${code}-${postcode}`;
}

/**
 * Legt die Firma an und gibt sie so zurück, wie sie in der Auswahlliste
 * steht: Name und fertige Anschrift ("Straße, D-59174 Kamen").
 */
export async function createCompany(
  table: CompanyTable,
  company: NewCompany
): Promise<{ name: string; address: string }> {
  const name = normalizeCompanyName(company.name);
  if (!name) throw new Error('Bitte einen Firmennamen eintragen.');

  const row = {
    name,
    strasse: company.strasse.trim() || null,
    plz: storedPostcode(company.land, company.plz) || null,
    ort: company.ort.trim() || null,
  };
  // Nur Kunden haben UID und BMD-Konto (für die Rechnung).
  const insert =
    table === 'site_companies'
      ? {
          ...row,
          uid_nummer: company.uidNummer.trim() || null,
          bmd_kto_nr: company.bmdKtoNr.trim() || null,
        }
      : row;

  const { error } = await supabase.from(table).insert(insert);
  if (error) {
    if (error.code === '23505') {
      throw new Error(`„${name}“ gibt es schon — bitte aus der Liste wählen.`);
    }
    throw new Error(error.message);
  }

  return { name, address: formatCompanyAddress(row) };
}
