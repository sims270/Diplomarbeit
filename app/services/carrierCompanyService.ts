import { companyKey, normalizeCompanyName } from '@/app/services/companyDirectory';
import { formatCompanyAddress, type AddressRow } from '@/app/services/companyAddress';
import { supabase } from '@/lib/supabase';

/**
 * Backs the "An Firma" combobox on the Fremdauftrag form: a dropdown of
 * carrier companies used before, plus the option to just type a new one.
 *
 * Anders als eine Ladestelle hat ein Frächter EINE Geschäftsanschrift, nicht
 * mehrere Standorte — der Name bleibt hier also die Identität, und die
 * Anschrift hängt als Eigenschaft daran.
 *
 * Table: supabase/migrations/20260907120000_create_carrier_companies.sql
 * (Anschrift kommt mit 20260911160000_add_recipient_address.sql dazu.)
 */
export interface CarrierCompany {
  name: string;
  /** Vollständige Anschrift "Straße, A-PLZ Ort" — leer, wenn nichts hinterlegt ist. */
  address: string;
}

/**
 * Fails soft (leere Liste): Eine fehlende Spalte oder ein nicht
 * erreichbares Supabase darf das Anlegen eines Auftrags nie blockieren —
 * die Firma lässt sich immer auch frei eintippen.
 */
export async function getCarrierCompanies(): Promise<CarrierCompany[]> {
  const { data, error } = await supabase
    .from('carrier_companies')
    .select('name, strasse, plz, ort')
    .order('name');

  if (error) {
    console.warn('[carrierCompanyService] could not load companies:', error.message);
    return [];
  }

  const companies = data.map((row) => ({
    name: row.name as string,
    address: formatCompanyAddress(row as AddressRow),
  }));

  // Zusammengelegt wird nur, was in Name UND Anschrift übereinstimmt und
  // sich bloß in Schreibweise oder Leerzeichen unterscheidet.
  //
  // Nicht über den Namen allein: Ein Frächter kann mehrfach vorkommen —
  // dieselbe Firma an verschiedenen Standorten, wie bei den Ladestellen.
  // Genau diese Annahme war in 20260911140000 falsch und hat dort Zeilen
  // gekostet; 20260911170000 holt sie zurück.
  const seen = new Set<string>();
  return companies.filter((company) => {
    const key = `${companyKey(company.name)}|${companyKey(company.address)}`;
    if (!companyKey(company.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Merkt einen frisch eingetippten Frächter samt Anschrift fürs nächste Mal.
 *
 * Eine schon bekannte Firma bekommt ihre Anschrift nachgetragen, wenn dort
 * noch keine steht — überschrieben wird nie: Was der Chef beim einzelnen
 * Auftrag abweichend eintippt (etwa eine Zweigstelle), soll die hinterlegte
 * Geschäftsanschrift nicht ersetzen.
 */
export async function addCarrierCompanyIfNew(name: string, address = ''): Promise<void> {
  const cleanName = normalizeCompanyName(name);
  if (!cleanName) return;

  // Kein upsert: Sein Konfliktziel wäre ein UNIQUE auf name, und das gibt
  // es auf dieser Tabelle nicht (siehe 20260911170000). Genau deshalb
  // sammelten sich dort vorher identische Zeilen — der Riegel sitzt jetzt
  // hier, und zwar über Name UND Anschrift: Derselbe Frächter an einem
  // zweiten Standort ist ein eigener Eintrag, derselbe Standort zweimal
  // nicht.
  const existing = await getCarrierCompanies();
  const cleanAddress = normalizeCompanyName(address);
  const sameName = existing.filter((c) => companyKey(c.name) === companyKey(cleanName));

  // Diesen Standort gibt es schon.
  if (sameName.some((c) => companyKey(c.address) === companyKey(cleanAddress))) return;

  // Der Frächter ist bekannt, aber ohne Anschrift hinterlegt: nachtragen,
  // statt eine zweite Zeile mit demselben Namen anzulegen. Eine schon
  // gepflegte Anschrift bleibt unangetastet (.is('strasse', null)).
  if (cleanAddress && sameName.some((c) => !c.address)) {
    const { error } = await supabase
      .from('carrier_companies')
      .update({ strasse: cleanAddress })
      .eq('name', cleanName)
      .is('strasse', null);

    if (error) {
      console.warn('[carrierCompanyService] could not save address:', error.message);
    }
    return;
  }

  const { error } = await supabase
    .from('carrier_companies')
    .insert({ name: cleanName, strasse: cleanAddress || null });

  if (error) {
    console.warn('[carrierCompanyService] could not save company:', error.message);
  }
}
