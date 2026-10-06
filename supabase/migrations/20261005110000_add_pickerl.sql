-- Pickerl (§57a-Begutachtung) je LKW: bis wann die nächste Überprüfung
-- gemacht sein muss. Ein Monat vorher erinnert die App den Chef daran —
-- gleich wie beim Service (20260911180000), nur nach Datum statt nach
-- Kilometern.
--
--   pickerl_due_date  Der Monat, der auf dem Pickerl gelocht ist, als
--                     Datum. null heißt "für diesen LKW nicht überwacht" —
--                     etwa ein gerade gekaufter LKW, dessen Pickerl der Chef
--                     noch nicht nachgeschaut hat.
--
-- Nach der Begutachtung quittiert der Chef sie in der App, und das Datum
-- rückt um ein Jahr weiter (LKW über 3,5 t: jährlich). Eine eigene Spalte
-- für das Intervall braucht es deshalb nicht.
alter table public.license_plates
  add column if not exists pickerl_due_date date;

notify pgrst, 'reload schema';
