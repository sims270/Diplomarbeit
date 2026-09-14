-- Preise in der Tankliste.
--
-- Bisher standen sie bewusst nicht in der Datenbank (siehe
-- 20260909100000_create_tank_entries.sql): Sie stehen nicht auf dem Zettel
-- des Fahrers, der Chef trug sie im Excel-Export von Hand nach. Das hatte
-- einen Haken, der erst mit dem wiederholten Export sichtbar wurde: Jede
-- neue Datei kam ohne die Preise der alten. Neue Tankungen und nachgetragene
-- Preise ließen sich nur zusammenführen, indem der Chef Zeilen von einer
-- Datei in die andere übertrug — und genau dabei rutscht ein Preis auf die
-- falsche Tankung, ohne dass es auffällt.
--
-- Mit den Preisen in der Datenbank ist jeder Export vollständig. Die Datei
-- auf dem Rechner des Chefs darf dann bei jedem Export neu geschrieben
-- werden, ohne dass etwas verloren geht.
--
-- Die Werte entsprechen den Spalten der Excel-Datei des Chefs:
--   price_adblue     "Preis AdBlue", steht direkt hinter "Liter AdBlue".
--                    Nur sinnvoll, wenn bei der Tankung AdBlue nachgefüllt
--                    wurde — sonst bleibt es leer.
--   price_per_liter  "Preis/Liter" (Diesel), vier Nachkommastellen (1,3775 €)
--   price_total      "Preis ges.", der Betrag laut Tankbeleg
-- Alle von Hand und keine Rechnung dazwischen: Auf dem Beleg steht der
-- Gesamtbetrag oft mit Rabatt oder anders gerundet — ausgerechnete Werte
-- ergäben dann Beträge, die auf keinem Beleg stehen.
alter table public.tank_entries
  add column if not exists price_adblue numeric(10, 4),
  add column if not exists price_per_liter numeric(10, 4),
  add column if not exists price_total numeric(10, 2);

alter table public.tank_entries
  drop constraint if exists tank_entries_prices_check;

alter table public.tank_entries
  add constraint tank_entries_prices_check check (
    (price_adblue is null or price_adblue > 0)
    and (price_per_liter is null or price_per_liter > 0)
    and (price_total is null or price_total > 0)
  );

-- Der Chef trägt die Preise ein — über eine Funktion statt einer
-- UPDATE-Policy.
--
-- Die Tankliste hat bewusst gar keine UPDATE-Policy: Sie ist ein
-- Fahrtenbuch, kein bearbeitbares Dokument. Eine Policy für den Chef würde
-- ihm, weil RLS Zeilen prüft und keine Spalten, auch das Ändern von
-- Kilometerstand, Litern und Datum erlauben. Diese Funktion kann genau die
-- Preisfelder setzen und sonst nichts — dasselbe Muster wie
-- complete_order für den Fahrer.
--
-- Eine frühere Fassung dieser Datei kannte nur zwei Preise. Falls sie schon
-- lief, stünde die dreiargumentige Funktion neben der neuen, und PostgREST
-- könnte nicht entscheiden, welche gemeint ist. Deshalb zuerst weg damit —
-- so lässt sich diese Datei gefahrlos (erneut) ausführen.
drop function if exists public.set_tank_entry_prices(uuid, numeric, numeric);

create or replace function public.set_tank_entry_prices(
  entry_id uuid,
  price_adblue numeric,
  price_per_liter numeric,
  price_total numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'boss' then
    raise exception 'Nur der Chef kann Preise eintragen'
      using errcode = 'insufficient_privilege';
  end if;

  update public.tank_entries
     set -- Ohne nachgefülltes AdBlue gibt es auch keinen AdBlue-Preis; ein
         -- versehentlich mitgeschickter Wert wird verworfen.
         price_adblue = case
           when liters_adblue is null then null
           else set_tank_entry_prices.price_adblue
         end,
         price_per_liter = set_tank_entry_prices.price_per_liter,
         price_total = set_tank_entry_prices.price_total
   where id = entry_id;

  if not found then
    raise exception 'Tankeintrag nicht gefunden'
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric) from public;
revoke all on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric) from anon;
grant execute on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric) to authenticated;

notify pgrst, 'reload schema';
