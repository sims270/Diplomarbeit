-- Service-Intervall je LKW: nach wie vielen Kilometern der nächste Service
-- fällig ist. Der Chef wählt das Intervall, es gilt dann immer wieder —
-- alle 60.000 km, nicht einmalig bei 60.000 km.
--
-- Zwei Spalten, nicht eine:
--
--   service_interval_km  Der Abstand zwischen zwei Services. null heißt
--                        "für diesen LKW nicht überwacht" — ein Anhänger
--                        oder ein gerade gekaufter LKW soll nicht sofort
--                        eine Meldung auslösen.
--
--   last_service_km      Der Kilometerstand beim letzten Service. Ohne den
--                        ließe sich die Meldung nach dem Service nie
--                        abstellen: Fällig ist der Service, wenn
--                        km_stand - last_service_km >= service_interval_km.
--                        Damit rückt die Grenze nach jedem Service von
--                        selbst weiter, und ein ausgelassener Service
--                        verschiebt den nächsten nicht.
--
-- Der Kilometerstand selbst kommt weiterhin aus der Tankliste (Trigger in
-- 20260911110000) — der Chef trägt hier nichts nach, er quittiert nur den
-- erledigten Service.
alter table public.license_plates
  add column if not exists service_interval_km integer,
  add column if not exists last_service_km integer;

-- Ein Intervall von 0 oder negativ wäre keine Angabe, sondern ein
-- Tippfehler — und eine Dauerschleife an Meldungen. Die Obergrenze ist
-- großzügig: Mehr als eine Million Kilometer fährt kein LKW zwischen zwei
-- Services.
alter table public.license_plates
  drop constraint if exists license_plates_service_interval_check;

alter table public.license_plates
  add constraint license_plates_service_interval_check check (
    service_interval_km is null
    or (service_interval_km between 1000 and 1000000)
  );

alter table public.license_plates
  drop constraint if exists license_plates_last_service_km_check;

alter table public.license_plates
  add constraint license_plates_last_service_km_check check (
    last_service_km is null or last_service_km >= 0
  );

notify pgrst, 'reload schema';
