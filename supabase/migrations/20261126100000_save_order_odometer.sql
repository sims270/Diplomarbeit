-- Kilometerstände schon vor dem Abschließen speichern.
--
-- Bisher kamen die drei Tachostände erst mit complete_order in die
-- Datenbank. Der Fahrer trägt den Ladestand aber an der Ladestelle ein und
-- den Abladestand oft erst Tage später; verließ er dazwischen die Seite,
-- waren seine Eingaben weg.
--
-- save_order_odometer speichert die Stände eines offenen Auftrags als
-- Zwischenstand. Leer- und Frachtkilometer rechnet weiterhin erst
-- complete_order aus, und dort bleiben alle drei Stände Pflicht.
--
-- Abgelehnt wird mit festen Kennungen, die die App übersetzt:
--   ORDER_ALREADY_COMPLETED  Auftrag ist bereits erledigt
--   ORDER_NOT_OPEN           Auftrag ist storniert
--   ORDER_KM_ORDER           nicht Start ≤ Laden ≤ Abladen (bzw. negativ)
--   ORDER_KM_TOO_HIGH        mehr als 10.000 km zwischen Start und Abladen
--
-- Setzt 20260930110000_odometer_readings.sql voraus. Wie alle Migrationen
-- dieses Projekts beliebig oft ausführbar.

create or replace function public.save_order_odometer(
  order_id uuid,
  start_odometer integer default null,
  loading_odometer integer default null,
  unloading_odometer integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.orders;
  vorhandene public.orders;
begin
  -- Parameter heißen wie die Spalten und werden deshalb immer als
  -- save_order_odometer.<name> angesprochen, Spalten über den Alias o.
  -- for update: nicht gleichzeitig mit complete_order durchrutschen.
  select o.* into vorhandene
    from public.orders o
   where o.id = save_order_odometer.order_id
     and o.assigned_to = auth.uid()
   for update;

  if not found then
    raise exception 'Auftrag nicht gefunden oder nicht diesem Fahrer zugewiesen'
      using errcode = 'insufficient_privilege';
  end if;

  if vorhandene.status = 'completed' then
    raise exception 'ORDER_ALREADY_COMPLETED' using errcode = 'check_violation';
  end if;

  if vorhandene.status = 'cancelled' then
    raise exception 'ORDER_NOT_OPEN' using errcode = 'check_violation';
  end if;

  -- Beim Beilader gibt es keine Kilometerstände; nichts zu speichern.
  if vorhandene.cargo_type is distinct from 'komplett' then
    return vorhandene;
  end if;

  -- Dieselben Regeln wie orders_odometer_check, nur mit einer Kennung, die
  -- die App versteht. Fehlende Stände (null) werden übersprungen.
  if save_order_odometer.start_odometer < 0
     or save_order_odometer.loading_odometer < 0
     or save_order_odometer.unloading_odometer < 0
     or save_order_odometer.start_odometer > save_order_odometer.loading_odometer
     or save_order_odometer.loading_odometer > save_order_odometer.unloading_odometer
     or save_order_odometer.start_odometer > save_order_odometer.unloading_odometer then
    raise exception 'ORDER_KM_ORDER' using errcode = 'check_violation';
  end if;

  if save_order_odometer.unloading_odometer::bigint - save_order_odometer.start_odometer::bigint > 10000 then
    raise exception 'ORDER_KM_TOO_HIGH' using errcode = 'check_violation';
  end if;

  update public.orders o
     set start_odometer = save_order_odometer.start_odometer,
         loading_odometer = save_order_odometer.loading_odometer,
         unloading_odometer = save_order_odometer.unloading_odometer,
         updated_at = now()
   where o.id = save_order_odometer.order_id
     and o.assigned_to = auth.uid()
  returning o.* into updated;

  return updated;
end;
$$;

revoke all on function public.save_order_odometer(uuid, integer, integer, integer) from public;
revoke all on function public.save_order_odometer(uuid, integer, integer, integer) from anon;
grant execute on function public.save_order_odometer(uuid, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
