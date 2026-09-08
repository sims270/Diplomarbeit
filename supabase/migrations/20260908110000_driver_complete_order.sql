-- Fahrer schließen ihre eigenen Aufträge ab.
--
-- Die Policies aus 20260907150000_create_orders.sql lassen einen Fahrer nur
-- lesen — schreiben darf ausschließlich der Chef. Eine zusätzliche
-- UPDATE-Policy für Fahrer wäre zu grob: RLS prüft Zeilen, nicht Spalten,
-- ein Fahrer könnte damit also auch Adressen, Zeiten oder die
-- Auftragsnummer seines Auftrags ändern. Stattdessen gibt es genau eine
-- security-definer-Funktion, die nichts anderes kann als den Status auf
-- 'completed' zu setzen — und das nur für den Auftrag, der dem
-- aufrufenden Fahrer auch wirklich zugewiesen ist.

-- Wann der Auftrag abgeschlossen wurde. Der Chef sieht das in seiner
-- Auftragsliste und im Auftragsdetail; updated_at allein würde dafür nicht
-- reichen, weil jede spätere Bearbeitung durch den Chef es überschreibt.
alter table public.orders
  add column if not exists completed_at timestamptz;

create or replace function public.complete_order(order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.orders;
begin
  update public.orders
     set status = 'completed',
         completed_at = now(),
         updated_at = now()
   where id = order_id
     -- Der Kern der Absicherung: fremde Auftrags-IDs treffen keine Zeile.
     and assigned_to = auth.uid()
  returning * into updated;

  if not found then
    raise exception 'Auftrag nicht gefunden oder nicht diesem Fahrer zugewiesen'
      using errcode = 'insufficient_privilege';
  end if;

  return updated;
end;
$$;

-- security definer heißt: die Funktion läuft mit den Rechten ihres
-- Besitzers. Deshalb bekommt sie nur der angemeldete Nutzer zu sehen, nicht
-- anon und nicht public.
revoke all on function public.complete_order(uuid) from public;
revoke all on function public.complete_order(uuid) from anon;
grant execute on function public.complete_order(uuid) to authenticated;

-- PostgREST hält den Funktions-/Tabellenkatalog im Cache. Ohne diesen
-- Anstoß meldet der Client "Could not find the function
-- public.complete_order(order_id) in the schema cache", bis der Cache von
-- selbst neu lädt.
notify pgrst, 'reload schema';
