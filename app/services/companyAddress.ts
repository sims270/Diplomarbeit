/**
 * Anschrift einer Firma aus den Spalten strasse/plz/ort, in der Form, die
 * direkt in ein Adressfeld des Formulars und auf den Transportauftrag geht.
 *
 * Von den Ladestellen (site_companies) und den Frächtern
 * (carrier_companies) gemeinsam genutzt — beide führen dieselben drei
 * Spalten, und die Schreibweise muss auf dem Papier dieselbe sein.
 */
export interface AddressRow {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
}

/**
 * "voestalpine-Straße 3, A-4020 Linz". Fehlt ein Teil in der Tabelle, fällt
 * er samt Trennzeichen weg, statt eine Lücke oder einen losen Beistrich zu
 * hinterlassen.
 */
export function formatCompanyAddress({ strasse, plz, ort }: AddressRow): string {
  const postcode = plz?.trim();
  const town = [postcode && withCountryCode(postcode), ort?.trim()].filter(Boolean).join(' ');
  return [strasse?.trim(), town].filter(Boolean).join(', ');
}

/**
 * Österreichische Schreibweise mit Länderkürzel vor der Postleitzahl. Ein
 * Land steht nicht in der Tabelle, das Kürzel ist deshalb fix "A-" — eine
 * PLZ, die schon eines mitbringt (etwa "D-59174" bei einer deutschen
 * Firma), bleibt unangetastet.
 */
function withCountryCode(postcode: string): string {
  return /^[A-Za-z]{1,3}-/.test(postcode) ? postcode : `A-${postcode}`;
}
