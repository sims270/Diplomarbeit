-- Fahrzeugdaten, die nur der Chef kennt: um welchen LKW es sich handelt
-- (Marke und Typ, z. B. "Volvo FH 460") und das Baujahr.
--
-- Anders als der Kilometerstand kommt das aus keiner anderen Quelle — es
-- steht auf keinem Zettel und in keiner Tankung. Deshalb tippt der Chef es
-- ein, in der LKW-Verwaltung (app/chef/vehicles/).
--
-- Beide Felder sind nullable: Der LKW entsteht in der Liste schon, sobald
-- ein Fahrer auf sein Kennzeichen tankt (siehe den Trigger in
-- 20260911110000). Ein Pflichtfeld würde diesen Weg blockieren — der
-- Trigger kennt weder Marke noch Baujahr.
alter table public.license_plates
  add column if not exists model text,
  add column if not exists year_built integer;

-- Ein Tippfehler wie 20205 oder 195 ist kein Baujahr. Obergrenze bewusst
-- großzügig: Ein LKW kann im Vorjahr des Modelljahrs schon zugelassen sein.
alter table public.license_plates
  drop constraint if exists license_plates_year_built_check;

alter table public.license_plates
  add constraint license_plates_year_built_check check (
    year_built is null
    or (year_built between 1950 and extract(year from now())::int + 1)
  );

-- Die Tabelle hatte bisher nur SELECT und INSERT (siehe
-- 20260911100000_create_license_plates.sql) — sie war eine reine
-- Nachschlageliste. Zum Nachtragen von Marke und Baujahr braucht der Chef
-- jetzt auch UPDATE.
--
-- Weiterhin kein DELETE: Das Kennzeichen ist der Schlüssel, über den die
-- Tankungen der Fahrer dem Fahrzeug zugeordnet werden. Ein gelöschtes
-- Fahrzeug entstünde bei der nächsten Tankung ohnehin neu — nur eben ohne
-- die hier eingetragenen Daten.
drop policy if exists "Boss can update license plates" on public.license_plates;

create policy "Boss can update license plates"
  on public.license_plates for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

notify pgrst, 'reload schema';
