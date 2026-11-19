-- Passwörter der fremden Fahrer wieder speichern, abgelaufene Zugänge
-- automatisch löschen.
--
-- Seit 20261106100000_drop_external_driver_password.sql sah der Chef das
-- Passwort nur einmal, direkt nach dem Anlegen. Für "Auftrag teilen" musste
-- deshalb jedes Mal ein neues Passwort her, und das alte galt nicht mehr —
-- auch für Aufträge, die der fremde Fahrer schon offen hatte.
--
-- Jetzt steht das Passwort wieder in external_driver_accounts.password,
-- solange es den Zugang gibt. Es verschwindet mit dem Zugang:
--   * wenn der Chef ihn löscht (Edge Function delete-external-driver), oder
--   * automatisch am Tag nach dem Ablaufdatum, wenn er nicht verlängert
--     wurde (Cron-Job unten).
--
-- Lesen darf es nur der Chef: Für den fremden Fahrer gibt es auf dieser
-- Tabelle keine Policy, und ändern dürfen Clients nur expires_on und label
-- (20260915130000_external_driver_access.sql). Geschrieben wird es nur von
-- den Edge Functions create-external-driver und
-- reset-external-driver-password. Die Passwörter der eigenen Fahrer und des
-- Chefs werden weiterhin nirgends gespeichert.
--
-- Bestehende Zugänge haben kein gespeichertes Passwort (null). Für sie
-- erstellt "Auftrag teilen" einmal ein neues, ab dann ist es gespeichert.
--
-- Zusammen mit den neuen Fassungen von create-external-driver und
-- reset-external-driver-password einspielen, und zwar diese Migration
-- zuerst: Die neuen Functions schreiben in die Spalte.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

-- --- 1. Spalte ----------------------------------------------------------------
alter table public.external_driver_accounts
  add column if not exists password text;

-- --- 2. Abgelaufene Zugänge löschen -------------------------------------------
-- Dasselbe wie delete-external-driver, nur ohne Chef: erst den Besitz an den
-- hochgeladenen Belegen freigeben (sonst verweigert Supabase das Löschen),
-- dann das Auth-Konto löschen. profiles und external_driver_accounts samt
-- Passwort verschwinden per Cascade, die Zuweisung an den Fremdaufträgen
-- wird null. Belege und CMR bleiben beim Auftrag.
--
-- Gelöscht wird am Tag nach expires_on: "gültig bis 01.12." meint den ganzen
-- 1. Dezember (Wiener Zeit, siehe vienna_today()).
create or replace function public.delete_expired_external_drivers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select a.user_id
      from public.external_driver_accounts a
      join public.profiles p on p.id = a.user_id
     where a.expires_on < public.vienna_today()
       -- Nur Fremdfahrer, nie ein eigener Fahrer oder der Chef.
       and p.role = 'external_driver'
  loop
    perform public.release_storage_ownership(r.user_id);
    delete from auth.users where id = r.user_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Nur der Cron-Job (läuft als postgres) ruft das auf, kein Client.
revoke all on function public.delete_expired_external_drivers() from public;
revoke all on function public.delete_expired_external_drivers() from anon;
revoke all on function public.delete_expired_external_drivers() from authenticated;

-- --- 3. Täglich ausführen -----------------------------------------------------
-- pg_cron ist bei Supabase dabei, muss aber eingeschaltet sein. Läuft um
-- 01:15 UTC, also kurz nach Mitternacht in Wien (02:15 bzw. 03:15).
create extension if not exists pg_cron;

-- Beim zweiten Lauf den alten Job ersetzen statt einen zweiten anzulegen.
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'delete-expired-external-drivers';

select cron.schedule(
  'delete-expired-external-drivers',
  '15 1 * * *',
  $$select public.delete_expired_external_drivers();$$
);

notify pgrst, 'reload schema';
