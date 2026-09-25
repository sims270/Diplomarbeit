-- CMR-Belege und Fotos am Auftrag vermerken.
--
-- Die Dateien selbst bleiben im Storage-Bucket "order-documents", ein
-- Ordner je Auftrag (20260908120000_order_documents.sql). In die Datenbank
-- kommen sie nicht: Das Free-Tier hat dort nur 500 MB. Die neue Spalte cmr
-- hält nur die Pfade fest — so steht am Auftrag selbst, welche Belege dazu
-- gehören, auch für Abfragen im Dashboard, ohne den Bucket durchsuchen zu
-- müssen. Es können mehrere Dateien sein (Vorder- und Rückseite, mehrere
-- Fotos), deshalb ein Array.
--
-- Geschrieben wird die Spalte nur über add_order_document und
-- remove_order_document unten, die App ruft sie direkt nach dem Hochladen
-- bzw. Löschen auf (app/services/orderDocumentService.ts).
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Spalten --------------------------------------------------------------
alter table public.orders
  add column if not exists cmr text[] not null default '{}';

alter table public.external_orders
  add column if not exists cmr text[] not null default '{}';

-- --- 2. Nachtrag der bisherigen Uploads -------------------------------------
-- Überschreibt cmr mit dem, was tatsächlich im Bucket liegt. Bei einem
-- zweiten Durchlauf kommt dasselbe heraus.
update public.orders o
   set cmr = sub.paths
  from (
    select (storage.foldername(name))[1] as order_id,
           array_agg(name order by created_at) as paths
      from storage.objects
     where bucket_id = 'order-documents'
     group by 1
  ) sub
 where o.id::text = sub.order_id;

update public.external_orders e
   set cmr = sub.paths
  from (
    select (storage.foldername(name))[1] as order_id,
           array_agg(name order by created_at) as paths
      from storage.objects
     where bucket_id = 'order-documents'
     group by 1
  ) sub
 where e.id::text = sub.order_id;

-- --- 3. Wer darf Belege an einem Auftrag vermerken --------------------------
-- Eine eigene Funktion, damit add_order_document und remove_order_document
-- dieselbe Regel verwenden. 20260915130000_external_driver_access.sql
-- ersetzt sie um den Fall "fremder Fahrer".
--
--   p_removing = true: Ein Fahrer darf nur solange entfernen, wie der
--   Auftrag offen ist — dieselbe Regel wie die Storage-Policy "Driver
--   deletes documents of open own orders".
create or replace function public.can_write_order_documents(
  p_order_id uuid,
  p_removing boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.app_role();
begin
  if v_role = 'boss' then
    return exists (select 1 from public.orders where id = p_order_id)
        or exists (select 1 from public.external_orders where id = p_order_id);
  end if;

  if v_role = 'driver' then
    return exists (
      select 1
        from public.orders o
       where o.id = p_order_id
         and o.assigned_to = auth.uid()
         and (not p_removing or o.status <> 'completed')
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_write_order_documents(uuid, boolean) from public;
revoke all on function public.can_write_order_documents(uuid, boolean) from anon;
revoke all on function public.can_write_order_documents(uuid, boolean) from authenticated;

-- --- 4. Beleg vermerken / austragen -----------------------------------------
-- security definer, weil der Fahrer Aufträge per RLS nicht bearbeiten darf
-- (siehe 20260908110000_driver_complete_order.sql). Die Funktionen können
-- genau eine Sache: einen Pfad in cmr ein- oder austragen.
create or replace function public.add_order_document(order_id uuid, path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Der Pfad muss direkt im Ordner dieses Auftrags liegen, sonst könnte man
  -- einem Auftrag die Datei eines anderen unterschieben.
  if coalesce(array_length(storage.foldername(add_order_document.path), 1), 0) <> 1
     or (storage.foldername(add_order_document.path))[1] <> add_order_document.order_id::text then
    raise exception 'Datei gehört nicht zu diesem Auftrag'
      using errcode = 'invalid_parameter_value';
  end if;

  if not public.can_write_order_documents(add_order_document.order_id, false) then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nur, was wirklich hochgeladen wurde.
  if not exists (
    select 1
      from storage.objects so
     where so.bucket_id = 'order-documents'
       and so.name = add_order_document.path
  ) then
    raise exception 'Datei nicht gefunden'
      using errcode = 'no_data_found';
  end if;

  update public.orders o
     set cmr = array_append(o.cmr, add_order_document.path)
   where o.id = add_order_document.order_id
     and not (add_order_document.path = any (o.cmr));

  update public.external_orders e
     set cmr = array_append(e.cmr, add_order_document.path)
   where e.id = add_order_document.order_id
     and not (add_order_document.path = any (e.cmr));
end;
$$;

create or replace function public.remove_order_document(order_id uuid, path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_write_order_documents(remove_order_document.order_id, true) then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung'
      using errcode = 'insufficient_privilege';
  end if;

  update public.orders o
     set cmr = array_remove(o.cmr, remove_order_document.path)
   where o.id = remove_order_document.order_id;

  update public.external_orders e
     set cmr = array_remove(e.cmr, remove_order_document.path)
   where e.id = remove_order_document.order_id;
end;
$$;

revoke all on function public.add_order_document(uuid, text) from public;
revoke all on function public.add_order_document(uuid, text) from anon;
grant execute on function public.add_order_document(uuid, text) to authenticated;

revoke all on function public.remove_order_document(uuid, text) from public;
revoke all on function public.remove_order_document(uuid, text) from anon;
grant execute on function public.remove_order_document(uuid, text) to authenticated;

notify pgrst, 'reload schema';
