-- AdBlue-Preis pro Liter in der Tankliste.
--
-- Bisher gab es beim AdBlue nur den Gesamtbetrag (price_adblue). Jetzt trägt
-- der Chef wie beim Diesel den Literpreis ein. Die App rechnet daraus den
-- Gesamtbetrag vor, der Chef kann ihn aber überschreiben: Auf dem Beleg steht
-- er manchmal mit Rabatt oder anders gerundet. Gespeichert werden deshalb
-- beide Werte, so wie die App sie abschickt.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.tank_entries
  add column if not exists price_adblue_per_liter numeric(10, 4);

alter table public.tank_entries
  drop constraint if exists tank_entries_price_adblue_per_liter_check;

alter table public.tank_entries
  add constraint tank_entries_price_adblue_per_liter_check check (
    price_adblue_per_liter is null or price_adblue_per_liter > 0
  );

-- Ohne nachgefülltes AdBlue gibt es auch keinen Literpreis, egal auf welchem
-- Weg die Zeile geändert wird (set_tank_entry_prices oder update_tank_entry).
create or replace function public.clear_adblue_price_per_liter()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.liters_adblue is null then
    new.price_adblue_per_liter := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tank_entries_clear_adblue_price_per_liter on public.tank_entries;

create trigger tank_entries_clear_adblue_price_per_liter
  before insert or update on public.tank_entries
  for each row
  execute function public.clear_adblue_price_per_liter();

-- Die alte Fassung mit vier Argumenten muss weg, sonst könnte PostgREST nicht
-- entscheiden, welche gemeint ist.
drop function if exists public.set_tank_entry_prices(uuid, numeric, numeric, numeric);

create or replace function public.set_tank_entry_prices(
  entry_id uuid,
  price_adblue numeric,
  price_adblue_per_liter numeric,
  price_per_liter numeric,
  price_total numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.app_role(), '') <> 'boss' then
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
         price_adblue_per_liter = set_tank_entry_prices.price_adblue_per_liter,
         price_per_liter = set_tank_entry_prices.price_per_liter,
         price_total = set_tank_entry_prices.price_total
   where id = entry_id;

  if not found then
    raise exception 'Tankeintrag nicht gefunden'
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric, numeric) from public;
revoke all on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric, numeric) from anon;
grant execute on function public.set_tank_entry_prices(uuid, numeric, numeric, numeric, numeric) to authenticated;

notify pgrst, 'reload schema';
