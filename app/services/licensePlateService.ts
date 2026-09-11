import { supabase } from '@/lib/supabase';

/**
 * Die eigene LKW-Flotte. Gepflegt wird sie in der LKW-Verwaltung des Chefs
 * (app/chef/vehicles/); von dort aus wird einem Fahrer ein LKW zugeteilt.
 *
 * Table: supabase/migrations/20260911100000_create_license_plates.sql
 * (Fahrzeugdaten und Kilometerstand kommen in den beiden Migrationen
 * 20260911110000 und 20260911120000 dazu.)
 */

/**
 * Ein LKW in der Fahrzeugübersicht des Chefs.
 *
 * Der Kilometerstand wird hier nie geschrieben: Er kommt aus der Tankliste
 * des Fahrers und wird von einem Trigger nachgezogen (siehe
 * supabase/migrations/20260911110000_add_fleet_to_license_plates.sql).
 * `kmEntryDate` ist das Datum der Tankung, aus der der Stand stammt — also
 * "Stand vom", nicht "zuletzt angefasst".
 */
export interface Vehicle {
  id: string;
  plate: string;
  // Marke und Typ, z. B. "Volvo FH 460". Trägt der Chef selbst ein — steht
  // in keiner anderen Quelle. Leer, solange er es nicht getan hat: Ein LKW
  // entsteht in der Liste auch von selbst, sobald ein Fahrer auf sein
  // Kennzeichen tankt.
  model: string;
  yearBuilt: number | null;
  kmStand: number | null;
  kmEntryDate: string | null;
  // Ausgeflottet: verkauft, abgemeldet, verschrottet. null heißt "in der
  // Flotte". Der LKW bleibt mit allen Daten stehen, taucht aber bei der
  // Fahrerzuteilung nicht mehr auf.
  retiredAt: string | null;
  /** Abstand zwischen zwei Services in km; null = für diesen LKW nicht überwacht. */
  serviceIntervalKm: number | null;
  /** Kilometerstand beim letzten Service — der Nullpunkt des laufenden Intervalls. */
  lastServiceKm: number | null;
}

/**
 * Zur Auswahl stehende Service-Intervalle. Bewusst eine feste Liste statt
 * eines Zahlenfelds: Der Chef wählt das Intervall aus dem Serviceheft, und
 * eine Auswahl schließt Vertipper wie 6000 statt 60000 aus.
 */
export const SERVICE_INTERVAL_OPTIONS = [
  20000, 30000, 40000, 50000, 60000, 80000, 100000, 120000, 150000,
];

/**
 * Wie weit der LKW im laufenden Intervall ist.
 *
 * `null`, wenn für den LKW kein Intervall hinterlegt ist oder noch kein
 * Kilometerstand aus der Tankliste vorliegt — dann gibt es schlicht nichts
 * zu melden.
 *
 * Der Nullpunkt ist der Stand beim letzten Service. Fehlt der (Intervall
 * gerade erst gesetzt), zählt ab 0 — beim Speichern setzt der Screen ihn
 * allerdings gleich auf den aktuellen Stand, damit ein LKW mit 300.000 km
 * nicht sofort als überfällig dasteht.
 */
export interface ServiceStatus {
  /** Seit dem letzten Service gefahren. */
  drivenKm: number;
  /** Kilometerstand, bei dem der nächste Service fällig ist. */
  dueAtKm: number;
  /** Negativ, wenn schon überfällig. */
  remainingKm: number;
  isDue: boolean;
}

export function getServiceStatus(vehicle: Vehicle): ServiceStatus | null {
  if (!vehicle.serviceIntervalKm || vehicle.kmStand === null) return null;

  const since = vehicle.lastServiceKm ?? 0;
  const drivenKm = vehicle.kmStand - since;
  const dueAtKm = since + vehicle.serviceIntervalKm;

  return {
    drivenKm,
    dueAtKm,
    remainingKm: dueAtKm - vehicle.kmStand,
    isDue: drivenKm >= vehicle.serviceIntervalKm,
  };
}

/**
 * Wirft bei einem Fehler, statt eine leere Liste zurückzugeben: In der
 * Übersicht wäre die eine Falschaussage — "keine LKW eingetragen" sähe
 * genauso aus wie "Supabase nicht erreichbar". Wo eine leere Auswahl
 * verkraftbar ist (Fahrerzuteilung), fangen die Screens den Fehler selbst
 * ab.
 */
export async function getVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('license_plates')
    .select(
      'id, name, model, year_built, km_stand, km_entry_date, retired_at, service_interval_km, last_service_km'
    )
    .order('name');

  if (error) throw new Error(error.message);

  const vehicles = data.map((row) => ({
    id: row.id as string,
    plate: row.name as string,
    model: (row.model as string | null) ?? '',
    yearBuilt: (row.year_built as number | null) ?? null,
    kmStand: (row.km_stand as number | null) ?? null,
    kmEntryDate: (row.km_entry_date as string | null) ?? null,
    retiredAt: (row.retired_at as string | null) ?? null,
    serviceIntervalKm: (row.service_interval_km as number | null) ?? null,
    lastServiceKm: (row.last_service_km as number | null) ?? null,
  }));

  // Ausgeflottete nach hinten: In der Übersicht stehen sie weiterhin (der
  // Chef will den letzten Kilometerstand eines verkauften LKW noch sehen),
  // aber die aktuelle Flotte gehört nach oben.
  return vehicles.sort((a, b) => {
    if ((a.retiredAt === null) !== (b.retiredAt === null)) {
      return a.retiredAt === null ? -1 : 1;
    }
    return a.plate.localeCompare(b.plate);
  });
}

/** Nur die LKW, die noch fahren — für die Zuteilung an einen Fahrer. */
export async function getActiveVehicles(): Promise<Vehicle[]> {
  return (await getVehicles()).filter((vehicle) => vehicle.retiredAt === null);
}

/**
 * Nimmt einen LKW aus der Flotte oder holt ihn zurück.
 *
 * Kein DELETE: Die Fahrzeugdaten und der letzte Kilometerstand bleiben
 * erhalten, und der Trigger aus 20260911110000 legte den LKW bei einer
 * Tankung auf dieses Kennzeichen ohnehin kommentarlos neu an — dann aber
 * ohne Marke und Baujahr. Die Tankeinträge selbst hängen nicht an dieser
 * Tabelle und sind von beidem unberührt.
 */
export async function setVehicleRetired(id: string, retired: boolean): Promise<void> {
  const { error } = await supabase
    .from('license_plates')
    .update({ retired_at: retired ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Ein LKW so, wie ihn der Chef bei der Fahrerzuteilung lesen soll:
 * "LN-TSH01 — Scania S 650 (2021)". Marke und Baujahr sind optional und
 * fallen weg, solange sie nicht eingetragen sind — das Kennzeichen steht
 * immer zuerst, denn daran erkennt er den LKW auf dem Hof.
 */
export function formatVehicle(vehicle: Vehicle): string {
  const details = [vehicle.model, vehicle.yearBuilt ? `(${vehicle.yearBuilt})` : '']
    .filter(Boolean)
    .join(' ');

  return details ? `${vehicle.plate} — ${details}` : vehicle.plate;
}

/** Untergrenze wie der CHECK in der Migration; Obergrenze mitwachsend. */
export const MIN_YEAR_BUILT = 1950;
export const MAX_YEAR_BUILT = new Date().getFullYear() + 1;

/**
 * Marke/Typ und Baujahr eines LKW — das einzige an einem Fahrzeug, das der
 * Chef von Hand pflegt. Kennzeichen und Kilometerstand bleiben bewusst
 * außen vor: Das Kennzeichen ist der Schlüssel zu den Tankungen, der
 * Kilometerstand kommt aus der Tankliste.
 */
export async function saveVehicleDetails(
  id: string,
  details: {
    model: string;
    yearBuilt: number | null;
    serviceIntervalKm: number | null;
    lastServiceKm: number | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('license_plates')
    .update({
      model: details.model.trim() || null,
      year_built: details.yearBuilt,
      service_interval_km: details.serviceIntervalKm,
      last_service_km: details.lastServiceKm,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Quittiert einen erledigten Service: Das Intervall beginnt beim aktuellen
 * Kilometerstand neu.
 *
 * Bewusst der aktuelle Stand und nicht der rechnerisch fällige: Wird ein
 * Service später gemacht als vorgesehen, zählt der Zeitpunkt, an dem er
 * wirklich stattgefunden hat — sonst wäre der nächste sofort wieder
 * überfällig.
 */
export async function markServiceDone(id: string, kmStand: number): Promise<void> {
  const { error } = await supabase
    .from('license_plates')
    .update({ last_service_km: kmStand })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Legt einen LKW an. Der einzige Weg, auf dem ein Fahrzeug bewusst in die
 * Flotte kommt — daneben entsteht eines automatisch, wenn ein Fahrer auf
 * ein unbekanntes Kennzeichen tankt (Trigger in 20260911110000).
 */
export async function addVehicle(details: {
  plate: string;
  model: string;
  yearBuilt: number | null;
}): Promise<void> {
  const { error } = await supabase.from('license_plates').insert({
    name: details.plate.trim().toUpperCase(),
    model: details.model.trim() || null,
    year_built: details.yearBuilt,
  });

  if (error) throw new Error(error.message);
}
