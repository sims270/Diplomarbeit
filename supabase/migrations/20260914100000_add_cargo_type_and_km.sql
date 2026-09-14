-- Ladungsart am Auftrag und die Kilometer, die der Fahrer beim Erledigen
-- einträgt.
--
-- Der Chef weiß beim Anlegen, ob eine Fuhre eine Komplettladung ist oder
-- ein Beilader. Daran hängt, ob die Kilometer überhaupt zu erfassen sind:
--
--   'komplett'  Der LKW fährt die Ladung allein. Leerkilometer (Anfahrt
--               zur Ladestelle) und Frachtkilometer (Ladestelle bis
--               Entladestelle) gehören zur Nachkalkulation der Fuhre.
--   'beilader'  Die Ladung teilt sich die Tour mit anderen. Eine Zuordnung
--               von Kilometern zu genau dieser Ladung gibt es nicht —
--               deshalb wird beim Erledigen gar nicht danach gefragt.
--
-- Warum die Ladungsart an den Auftrag gehört und nicht als Häkchen zum
-- Fahrer: Ein leeres Kilometerfeld hieße sonst entweder "Beilader" oder
-- "vergessen", und das ließe sich in der Auswertung nie mehr trennen. So
-- ist die Erfassung bei einer Komplettladung verpflichtend und beim
-- Beilader gar nicht erst vorhanden.
--
-- Vorgabe 'komplett': Der häufigere Fall, und die Vorgabe, bei der nichts
-- unbemerkt fehlt. Bestehende Aufträge bekommen sie ebenfalls; ihre
-- Kilometer bleiben null, weil sie vor dieser Änderung erledigt wurden.
alter table public.orders
  add column if not exists cargo_type text not null default 'komplett',
  add column if not exists empty_km integer,
  add column if not exists freight_km integer;

alter table public.orders
  drop constraint if exists orders_cargo_type_check;

alter table public.orders
  add constraint orders_cargo_type_check check (cargo_type in ('komplett', 'beilader'));

-- Negative Kilometer sind keine Fahrt, sondern ein Tippfehler. 0 bleibt
-- erlaubt: Steht der LKW schon an der Ladestelle, sind es 0 Leerkilometer.
alter table public.orders
  drop constraint if exists orders_km_check;

alter table public.orders
  add constraint orders_km_check check (
    (empty_km is null or empty_km >= 0)
    and (freight_km is null or freight_km >= 0)
  );

-- Die Abschlussfunktion nimmt die Kilometer mit entgegen.
--
-- Warum hier und nicht über eine UPDATE-Policy: unverändert der Grund aus
-- 20260908110000 — RLS prüft Zeilen, nicht Spalten. Eine Policy, die dem
-- Fahrer das Schreiben der Kilometer erlaubt, erlaubte ihm auch das
-- Ändern von Adressen, Zeiten und Auftragsnummer. Diese Funktion kann
-- weiterhin genau eine Sache, jetzt mit zwei zusätzlichen Feldern.
--
-- Die Prüfung "Komplettladung braucht Kilometer" steht bewusst AUCH hier
-- und nicht nur im Formular: Die Funktion ist die Stelle, an der ein
-- Auftrag tatsächlich erledigt wird.
create or replace function public.complete_order(
  order_id uuid,
  empty_km integer default null,
  freight_km integer default null
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
  -- Die Parameter heißen wie die Spalten (empty_km, freight_km) — die App
  -- ruft die Funktion mit genau diesen Namen auf. Ohne Präfix meldet
  -- Postgres deshalb 'column reference "empty_km" is ambiguous'. Parameter
  -- werden hier immer als complete_order.<name> angesprochen, Spalten über
  -- den Tabellenalias o.
  select o.* into vorhandene
    from public.orders o
   where o.id = complete_order.order_id
     and o.assigned_to = auth.uid();

  if not found then
    raise exception 'Auftrag nicht gefunden oder nicht diesem Fahrer zugewiesen'
      using errcode = 'insufficient_privilege';
  end if;

  if vorhandene.cargo_type = 'komplett'
     and (complete_order.empty_km is null or complete_order.freight_km is null) then
    raise exception 'Bei einer Komplettladung sind Leer- und Frachtkilometer anzugeben'
      using errcode = 'check_violation';
  end if;

  update public.orders o
     set status = 'completed',
         completed_at = now(),
         updated_at = now(),
         -- Beim Beilader bleibt es bei null, auch wenn die App etwas
         -- mitschickt: Zu dieser Ladung allein gehören keine Kilometer.
         empty_km = case when vorhandene.cargo_type = 'komplett' then complete_order.empty_km else null end,
         freight_km = case when vorhandene.cargo_type = 'komplett' then complete_order.freight_km else null end
   where o.id = complete_order.order_id
     and o.assigned_to = auth.uid()
  returning o.* into updated;

  return updated;
end;
$$;

-- Wie in 20260908110000: Die Funktion läuft mit den Rechten ihres
-- Besitzers, deshalb bekommt sie nur der angemeldete Nutzer.
revoke all on function public.complete_order(uuid, integer, integer) from public;
revoke all on function public.complete_order(uuid, integer, integer) from anon;
grant execute on function public.complete_order(uuid, integer, integer) to authenticated;

-- Die alte einargumentige Fassung entfällt, sonst stünden zwei
-- Überladungen nebeneinander und PostgREST müsste raten, welche gemeint
-- ist ("Could not choose the best candidate function").
drop function if exists public.complete_order(uuid);

notify pgrst, 'reload schema';
