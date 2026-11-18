-- Längenbegrenzung für Kennzeichen und Fahrername am Fremdauftrag.
--
-- Der fremde Fahrer trägt beide Werte selbst ein. Ohne Grenze könnte er
-- beliebig lange Texte speichern, die dann in Listen und Exporten landen.
--
-- Setzt 20260930100000_external_driver_sets_plate_and_name.sql voraus. Wie alle
-- Migrationen dieses Projekts beliebig oft ausführbar.

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

  if length(btrim(p_license_plate)) > 15 then
    raise exception 'Das Kennzeichen darf höchstens 15 Zeichen haben'
      using errcode = 'check_violation';
  end if;

  if length(btrim(p_driver_name)) > 100 then
    raise exception 'Der Fahrername darf höchstens 100 Zeichen haben'
      using errcode = 'check_violation';
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
