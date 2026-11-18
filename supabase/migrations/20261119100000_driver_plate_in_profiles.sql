-- Das Kennzeichen des Fahrers zieht aus dem user_metadata nach public.profiles.
--
-- user_metadata kann jeder angemeldete Nutzer selbst ändern. Ein Fahrer hätte
-- damit Fahrten in der Umsatzliste einem fremden LKW zuordnen und den letzten
-- Tachostand jedes beliebigen LKW abfragen können. profiles schreibt nur der
-- Server: Für Clients gibt es dort keine Schreib-Policy.
--
-- WICHTIG: gemeinsam mit den neuen Fassungen der Edge Functions create-driver,
-- update-driver, list-drivers und export-weekly-revenue einspielen.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.profiles
  add column if not exists license_plate text;

-- Nur wo noch nichts steht: Ein zweiter Durchlauf darf ein inzwischen vom Chef
-- geändertes Kennzeichen nicht mit dem alten Wert überschreiben.
update public.profiles p
   set license_plate = nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
  from auth.users u
 where u.id = p.id
   and p.role = 'driver'
   and p.license_plate is null;

-- Hält beim Erledigen fest, mit welchem LKW der Auftrag gefahren wurde.
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
    select p.license_plate
      into new.license_plate
      from public.profiles p
     where p.id = new.assigned_to;
  end if;

  return new;
end;
$$;

-- Der Abladestand des zuletzt erledigten Auftrags mit dem LKW des Fahrers.
-- Nur für Fahrer: Heraus kommt der Tachostand eines LKW der Firma.
create or replace function public.get_suggested_start_odometer()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select o.unloading_odometer
    from public.orders o
   where public.app_role() = 'driver'
     and o.status = 'completed'
     and o.unloading_odometer is not null
     and o.license_plate = (
       select p.license_plate
         from public.profiles p
        where p.id = auth.uid()
     )
   order by o.completed_at desc nulls last
   limit 1;
$$;

revoke all on function public.get_suggested_start_odometer() from public;
revoke all on function public.get_suggested_start_odometer() from anon;
grant execute on function public.get_suggested_start_odometer() to authenticated;

notify pgrst, 'reload schema';
