/**
 * Vergleichsschlüssel für handgetippte Kennzeichen — dieselbe Regel wie die
 * generierten Spalten tank_entries.license_plate_key und
 * license_plates.plate_key: "GR 400 FX", "gr400fx" und "GR400FX" sind
 * derselbe LKW.
 */
export function plateKey(plate: string): string {
  return plate.replace(/\s+/g, '').toUpperCase();
}
