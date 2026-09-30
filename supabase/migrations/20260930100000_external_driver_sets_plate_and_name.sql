-- Kennzeichen und Fahrername am Fremdauftrag, jetzt auch durch den fremden
-- Fahrer.
--
-- Beim Anlegen eines Fremdauftrags sind license_plate und driver_name für
-- den Chef optional — oft weiß er sie noch nicht. Es sind aber Kennzeichen
-- und Name des fremden Fahrers, also soll er sie selbst eintragen können.
--
-- Er hat auf external_orders keine update-Policy, und eine bekäme er auch
-- nicht: RLS prüft Zeilen, nicht Spalten, er könnte sonst die Preise
-- ändern. Deshalb wie complete_external_order eine Funktion, die genau diese
-- zwei Spalten setzt — nur am zugewiesenen, noch offenen Auftrag und nur
-- mit gültigem Zugang.
--
-- Setzt 20260915130000_external_driver_access.sql voraus. Beliebig oft
-- ausführbar.

create or replace function public.set_external_order_driver(
  order_id uuid,
  p_license_plate text,
  p_driver_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_active_external_access() then
    raise exception 'Zugang abgelaufen oder keine Berechtigung'
      using errcode = 'insufficient_privilege';
  end if;

  -- Leer wird wie beim Anlegen durch den Chef zu null.
  update public.external_orders e
     set license_plate = nullif(btrim(p_license_plate), ''),
         driver_name = nullif(btrim(p_driver_name), ''),
         updated_at = now()
   where e.id = set_external_order_driver.order_id
     and e.assigned_external_user_id = auth.uid()
     and e.status <> 'completed';

  if not found then
    raise exception 'Auftrag nicht gefunden, nicht zugewiesen oder schon erledigt'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.set_external_order_driver(uuid, text, text) from public;
revoke all on function public.set_external_order_driver(uuid, text, text) from anon;
grant execute on function public.set_external_order_driver(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
