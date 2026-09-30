-- Kilometerstände statt Leer- und Frachtkilometer (Statistik Austria).
--
-- Bei einer Komplettladung trägt der Fahrer künftig drei Tachostände des
-- LKW ein: am Start, an der Ladestelle und an der Entladestelle. Daraus
-- errechnet complete_order
--
--   empty_km   = Laden   − Start
--   freight_km = Abladen − Laden
--
-- empty_km und freight_km bleiben als Spalten erhalten. Umsatzliste,
-- Excel-Export und Chef-Ansicht lesen sie unverändert weiter.
--
-- Beim Beilader bleibt es wie in 20260914100000: keine Abfrage, alles null.
--
-- Setzt 20260914100000_add_cargo_type_and_km.sql und
-- 20260914120000_add_revenue_list.sql voraus. Beliebig oft ausführbar.

-- --- 1. Kilometerstände am Auftrag -----------------------------------------
alter table public.orders
  add column if not exists start_odometer integer,
  add column if not exists loading_odometer integer,
  add column if not exists unloading_odometer integer;

-- Ein Tacho zählt nur vorwärts. Negative Stände oder eine vertauschte
-- Reihenfolge sind Tippfehler.
alter table public.orders
  drop constraint if exists orders_odometer_check;

alter table public.orders
  add constraint orders_odometer_check check (
    (start_odometer is null or start_odometer >= 0)
    and (loading_odometer is null or loading_odometer >= 0)
    and (unloading_odometer is null or unloading_odometer >= 0)
    and (start_odometer is null or loading_odometer is null or start_odometer <= loading_odometer)
    and (loading_odometer is null or unloading_odometer is null or loading_odometer <= unloading_odometer)
  );

-- --- 2. Abschluss mit Kilometerständen ---------------------------------------
-- Die alte Fassung mit (uuid, integer, integer) entfällt, sonst stünden
-- zwei Überladungen nebeneinander und PostgREST müsste raten, welche
-- gemeint ist ("Could not choose the best candidate function").
drop function if exists public.complete_order(uuid, integer, integer);

create or replace function public.complete_order(
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
  ist_komplett boolean;
begin
  -- Wie in 20260914100000: Parameter heißen wie die Spalten und werden
  -- deshalb immer als complete_order.<name> angesprochen, Spalten über den
  -- Tabellenalias o.
  select o.* into vorhandene
    from public.orders o
   where o.id = complete_order.order_id
     and o.assigned_to = auth.uid();

  if not found then
    raise exception 'Auftrag nicht gefunden oder nicht diesem Fahrer zugewiesen'
      using errcode = 'insufficient_privilege';
  end if;

  ist_komplett := vorhandene.cargo_type = 'komplett';

  if ist_komplett then
    if complete_order.start_odometer is null
       or complete_order.loading_odometer is null
       or complete_order.unloading_odometer is null then
      raise exception 'Bei einer Komplettladung sind alle drei Kilometerstände anzugeben'
        using errcode = 'check_violation';
    end if;

    if complete_order.start_odometer < 0
       or complete_order.start_odometer > complete_order.loading_odometer
       or complete_order.loading_odometer > complete_order.unloading_odometer then
      raise exception 'Kilometerstände müssen Start ≤ Laden ≤ Abladen sein'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.orders o
     set status = 'completed',
         completed_at = now(),
         updated_at = now(),
         -- Beim Beilader bleibt alles null, auch wenn die App etwas
         -- mitschickt.
         start_odometer = case when ist_komplett then complete_order.start_odometer else null end,
         loading_odometer = case when ist_komplett then complete_order.loading_odometer else null end,
         unloading_odometer = case when ist_komplett then complete_order.unloading_odometer else null end,
         empty_km = case when ist_komplett
                         then complete_order.loading_odometer - complete_order.start_odometer
                         else null end,
         freight_km = case when ist_komplett
                           then complete_order.unloading_odometer - complete_order.loading_odometer
                           else null end
   where o.id = complete_order.order_id
     and o.assigned_to = auth.uid()
  returning o.* into updated;

  return updated;
end;
$$;

revoke all on function public.complete_order(uuid, integer, integer, integer) from public;
revoke all on function public.complete_order(uuid, integer, integer, integer) from anon;
grant execute on function public.complete_order(uuid, integer, integer, integer) to authenticated;

-- --- 3. Vorschlag für den Start-Kilometerstand -------------------------------
-- Der Abladestand des zuletzt erledigten Auftrags mit dem LKW, den der
-- angemeldete Fahrer heute fährt (user_metadata license_plate, wie im
-- Trigger snapshot_order_license_plate). Der Fahrer kann ihn im Formular
-- noch ändern.
--
-- security definer, weil auth.users nur mit erhöhten Rechten lesbar ist
-- und der Fahrer Aufträge anderer Fahrer auf demselben LKW per RLS nicht
-- sieht. Heraus kommt genau eine Zahl.
create or replace function public.get_suggested_start_odometer()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select o.unloading_odometer
    from public.orders o
   where o.status = 'completed'
     and o.unloading_odometer is not null
     and o.license_plate = (
       select nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
         from auth.users u
        where u.id = auth.uid()
     )
   order by o.completed_at desc nulls last
   limit 1;
$$;

revoke all on function public.get_suggested_start_odometer() from public;
revoke all on function public.get_suggested_start_odometer() from anon;
grant execute on function public.get_suggested_start_odometer() to authenticated;

notify pgrst, 'reload schema';
