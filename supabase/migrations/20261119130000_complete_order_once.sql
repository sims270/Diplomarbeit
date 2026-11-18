-- Ein Auftrag lässt sich nur einmal abschließen.
--
-- complete_order prüfte nicht, ob der Auftrag schon erledigt ist. Ein Fahrer
-- konnte damit Tachostände, Kilometer und Abschlusszeit eines längst
-- verrechneten Auftrags überschreiben.
--
-- Abgelehnt werden jetzt:
--   ORDER_ALREADY_COMPLETED  Auftrag ist bereits erledigt
--   ORDER_KM_TOO_HIGH        mehr als 10.000 km zwischen Start und Abladen
--
-- Die App übersetzt diese Kennungen in verständliche Meldungen.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

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
  -- Parameter heißen wie die Spalten und werden deshalb immer als
  -- complete_order.<name> angesprochen, Spalten über den Tabellenalias o.
  -- for update: Zwei gleichzeitige Aufrufe dürfen nicht beide durchkommen.
  select o.* into vorhandene
    from public.orders o
   where o.id = complete_order.order_id
     and o.assigned_to = auth.uid()
   for update;

  if not found then
    raise exception 'Auftrag nicht gefunden oder nicht diesem Fahrer zugewiesen'
      using errcode = 'insufficient_privilege';
  end if;

  if vorhandene.status = 'completed' then
    raise exception 'ORDER_ALREADY_COMPLETED' using errcode = 'check_violation';
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

    if complete_order.unloading_odometer::bigint - complete_order.start_odometer::bigint > 10000 then
      raise exception 'ORDER_KM_TOO_HIGH' using errcode = 'check_violation';
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

notify pgrst, 'reload schema';
