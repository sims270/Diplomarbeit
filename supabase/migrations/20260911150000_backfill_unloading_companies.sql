-- Füllt die Entladefirmen-Liste aus den Aufträgen, die es schon gibt.
--
-- Die Liste ist so gebaut, dass sie von selbst wächst: Eine frei
-- eingetippte Entladefirma trägt die App nach dem Anlegen des Auftrags
-- nach (addUnloadingCompanyIfNew). Auf dieser Datenbank kam die Tabelle
-- aber erst jetzt dazu — alles, was vorher eingetippt wurde, steht nur in
-- orders und external_orders und wäre im Dropdown nicht zu sehen. Ohne
-- diesen Nachtrag stünde die Liste leer da, obwohl die Firmen längst
-- bekannt sind.
--
-- Läuft nur, wenn die Tabelle existiert: Wer 20260910110000 noch nicht
-- eingespielt hat, soll hier eine klare Reihenfolge haben und keinen
-- Abbruch mitten in der Migrationskette.
do $$
begin
  if to_regclass('public.unloading_companies') is null then
    raise notice 'unloading_companies fehlt — zuerst 20260910110000 ausfuehren.';
    return;
  end if;

  -- Dieselbe Normalisierung wie im Dropdown (siehe
  -- 20260911140000_dedupe_company_names.sql): Ein nachlaufendes oder
  -- doppeltes Leerzeichen aus einem alten Auftrag soll keine zweite Firma
  -- werden. Die Funktion kann hier noch fehlen, deshalb der Fallback.
  insert into public.unloading_companies (name)
  select distinct on (lower(btrim(regexp_replace(replace(unloading_company, chr(160), ' '), '\s+', ' ', 'g'))))
         btrim(regexp_replace(replace(unloading_company, chr(160), ' '), '\s+', ' ', 'g'))
    from (
      select unloading_company from public.orders
      union all
      select unloading_company from public.external_orders
    ) alle
   where btrim(coalesce(unloading_company, '')) <> ''
  on conflict (name) do nothing;
end
$$;

notify pgrst, 'reload schema';
