-- Umsatzliste — die Excel-Liste des Chefs, in der er je LKW jede Fahrt mit
-- Datum, Frachtkilometern, Leerkilometern, Preis und Richtung ("hin",
-- "her", "FR - DE") notiert und daneben gelb die Beträge der Beilader.
--
-- Datum, Kilometer und Preis gibt es schon: Kilometer trägt der Fahrer beim
-- Erledigen ein (20260914100000), den Preis der Chef in der Rechnung
-- (20260910140000). Es fehlen zwei Dinge.

-- ------------------------------------------------------------ Richtung
-- Freitext statt fester Auswahl: Neben "hin" und "her" stehen in der Liste
-- auch "hin - her" und Länderpaare wie "FR - DE". Der Chef trägt sie in der
-- Umsatzliste nach (app/chef/umsatzliste.tsx), wie die Preise in der
-- Tankliste — die Berechtigung dazu hat er über "Boss can edit orders"
-- ohnehin.
alter table public.orders
  add column if not exists direction text;

-- ------------------------------------------------------------ LKW
-- Mit welchem LKW die Fahrt gefahren wurde. Am Auftrag hängt bisher nur der
-- Fahrer, und dessen LKW steht in seinem Konto (user_metadata
-- license_plate). Das ist aber der LKW von HEUTE: Teilt der Chef dem Fahrer
-- einen anderen LKW zu, wanderten sonst alle alten Fahrten in der
-- Umsatzliste mit auf das neue Fahrzeug. Deshalb wird das Kennzeichen beim
-- Erledigen am Auftrag festgehalten.
alter table public.orders
  add column if not exists license_plate text;

-- Als Trigger und nicht in complete_order: So hält er das Kennzeichen fest,
-- egal auf welchem Weg ein Auftrag erledigt wird, und complete_order bleibt
-- bei der einen Sache, die es kann.
--
-- security definer, weil auth.users nur mit erhöhten Rechten lesbar ist.
-- Gelesen wird genau ein Feld des zugewiesenen Fahrers.
create or replace function public.snapshot_order_license_plate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and new.license_plate is null
     and new.assigned_to is not null then
    select nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
      into new.license_plate
      from auth.users u
     where u.id = new.assigned_to;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_snapshot_license_plate on public.orders;

create trigger orders_snapshot_license_plate
  before update on public.orders
  for each row
  execute function public.snapshot_order_license_plate();

-- Nachtrag für schon erledigte Aufträge: Wann sie gefahren wurden, lässt
-- sich nicht mehr klären — der heutige LKW des Fahrers ist die beste
-- verfügbare Annahme. Stimmt sie nicht, korrigiert der Chef das Kennzeichen
-- direkt in Supabase.
update public.orders o
   set license_plate = nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
  from auth.users u
 where u.id = o.assigned_to
   and o.status = 'completed'
   and o.license_plate is null;

notify pgrst, 'reload schema';
