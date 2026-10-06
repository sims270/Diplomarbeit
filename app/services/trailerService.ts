import {
  addMonthsIso,
  getPickerlStatus,
  nextPickerlDueDate,
  type PickerlStatus,
} from '@/app/services/licensePlateService';
import { dateToIso } from '@/lib/dateFormat';
import { supabase } from '@/lib/supabase';

/**
 * Die Auflieger der Firma. Sie werden keinem LKW und keinem Fahrer
 * zugeteilt — der Chef führt sie nur, um rechtzeitig ans Pickerl erinnert
 * zu werden. Die Pickerl-Rechnung (Erinnerung, nächstes Datum) ist
 * dieselbe wie beim LKW und steht in licensePlateService.ts.
 *
 * Table: supabase/migrations/20261005120000_create_trailers.sql
 */
export interface Trailer {
  id: string;
  plate: string;
  /** Freitext wie "Kühlauflieger Schmitz"; leer, wenn nicht eingetragen. */
  description: string;
  /** Bis wann das nächste Pickerl gemacht sein muss ('YYYY-MM-DD'); null = nicht überwacht. */
  pickerlDueDate: string | null;
  /** Länderabhängige Genehmigungen, nach Ablaufdatum sortiert. */
  permits: TrailerPermit[];
}

/**
 * Eine Genehmigung eines Aufliegers, z. B. für ein bestimmtes Land.
 * Erinnert wird PERMIT_REMINDER_MONTHS vor Ablauf — die Rechnung dafür ist
 * dieselbe wie beim Pickerl (getPermitStatus).
 *
 * Table: supabase/migrations/20261005130000_create_trailer_permits.sql
 */
export interface TrailerPermit {
  id: string;
  name: string;
  /** 'YYYY-MM-DD' */
  validUntil: string;
  /** Wie viele Jahre eine Genehmigung gilt — um so viel verlängert "Erneuert". */
  validityYears: number;
}

/**
 * Wie lange vor Ablauf die Erinnerung an eine Genehmigung kommt. Kürzer
 * als beim Pickerl (PICKERL_REMINDER_MONTHS): Erneuern ist nur ein Antrag,
 * kein Werkstatttermin.
 */
export const PERMIT_REMINDER_MONTHS = 1;

/** Wie getPickerlStatus, nur mit dem Vorlauf der Genehmigungen. */
export function getPermitStatus(
  validUntil: string,
  today: string = dateToIso(new Date())
): PickerlStatus | null {
  return getPickerlStatus(validUntil, today, PERMIT_REMINDER_MONTHS);
}

/** Zur Auswahl stehende Gültigkeitsdauern in Jahren (CHECK in der Migration: 1–10). */
export const PERMIT_VALIDITY_YEARS = [1, 2, 3, 4, 5];

/** Wirft bei einem Fehler — "keine Auflieger" und "nicht erreichbar" sollen nicht gleich aussehen. */
export async function getTrailers(): Promise<Trailer[]> {
  const { data, error } = await supabase
    .from('trailers')
    .select('id, plate, description, pickerl_due_date, trailer_permits(id, name, valid_until, validity_years)')
    .order('plate');

  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id as string,
    plate: row.plate as string,
    description: (row.description as string | null) ?? '',
    pickerlDueDate: (row.pickerl_due_date as string | null) ?? null,
    permits: toPermits(row.trailer_permits),
  }));
}

function toPermits(rows: unknown): TrailerPermit[] {
  return ((rows ?? []) as { id: string; name: string; valid_until: string; validity_years: number | null }[])
    .map((row) => ({
      id: row.id,
      name: row.name,
      validUntil: row.valid_until,
      validityYears: row.validity_years ?? 1,
    }))
    .sort((a, b) => a.validUntil.localeCompare(b.validUntil));
}

/** Die Genehmigungen eines Aufliegers — für den Bearbeiten-Screen. */
export async function getTrailerPermits(trailerId: string): Promise<TrailerPermit[]> {
  const { data, error } = await supabase
    .from('trailer_permits')
    .select('id, name, valid_until, validity_years')
    .eq('trailer_id', trailerId);

  if (error) throw new Error(error.message);
  return toPermits(data);
}

export async function addTrailerPermit(
  trailerId: string,
  details: { name: string; validUntil: string; validityYears: number }
): Promise<void> {
  const { error } = await supabase.from('trailer_permits').insert({
    trailer_id: trailerId,
    name: details.name.trim(),
    valid_until: details.validUntil,
    validity_years: details.validityYears,
  });

  if (error) throw new Error(error.message);
}

/** Die Gültigkeitsdauer nachträglich ändern — etwa, wenn ein Land umstellt. */
export async function setPermitValidityYears(id: string, validityYears: number): Promise<void> {
  const { error } = await supabase
    .from('trailer_permits')
    .update({ validity_years: validityYears })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteTrailerPermit(id: string): Promise<void> {
  const { error } = await supabase.from('trailer_permits').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Das Ablaufdatum nach dem Erneuern: so viele Jahre später, wie die
 * Genehmigung gilt. Gerechnet vom alten Ablaufdatum, damit eine rechtzeitig
 * erneuerte Genehmigung keine Tage verliert; war sie schon abgelaufen, ab
 * heute — sonst stünde sie nach dem Erneuern womöglich gleich wieder als
 * abgelaufen da.
 */
export function nextPermitValidUntil(
  permit: Pick<TrailerPermit, 'validUntil' | 'validityYears'>,
  today: string = dateToIso(new Date())
): string {
  const from = permit.validUntil < today ? today : permit.validUntil;
  return addMonthsIso(from, 12 * permit.validityYears);
}

/** Quittiert eine erneuerte Genehmigung und gibt das neue Ablaufdatum zurück. */
export async function renewTrailerPermit(permit: TrailerPermit): Promise<string> {
  const { id } = permit;
  const next = nextPermitValidUntil(permit);
  const { error } = await supabase
    .from('trailer_permits')
    .update({ valid_until: next })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return next;
}

export async function addTrailer(details: {
  plate: string;
  description: string;
  pickerlDueDate: string | null;
}): Promise<void> {
  const { error } = await supabase.from('trailers').insert({
    plate: details.plate.trim().toUpperCase(),
    description: details.description.trim() || null,
    pickerl_due_date: details.pickerlDueDate,
  });

  if (error) throw new Error(error.message);
}

/**
 * Anders als beim LKW darf sich das Kennzeichen hier ändern: Es ist kein
 * Schlüssel zu anderen Daten.
 */
export async function saveTrailer(
  id: string,
  details: { plate: string; description: string; pickerlDueDate: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('trailers')
    .update({
      plate: details.plate.trim().toUpperCase(),
      description: details.description.trim() || null,
      pickerl_due_date: details.pickerlDueDate,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/** Endgültig — an einem Auflieger hängt nichts, das erhalten bleiben müsste. */
export async function deleteTrailer(id: string): Promise<void> {
  const { error } = await supabase.from('trailers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Quittiert das Pickerl wie beim LKW (markPickerlDone) und gibt das neue Datum zurück. */
export async function markTrailerPickerlDone(id: string, dueDate: string): Promise<string> {
  const next = nextPickerlDueDate(dueDate);
  const { error } = await supabase
    .from('trailers')
    .update({ pickerl_due_date: next })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return next;
}
