-- Die Kennzeichen der eigenen LKW-Flotte. Backt das Dropdown im Feld
-- "Kennzeichen" beim Anlegen und Bearbeiten eines Fahrers: Der Chef teilt
-- jedem Fahrer seinen LKW zu und soll ihn dabei auswählen können, statt ihn
-- jedes Mal abzutippen — ein Vertipper landete sonst still im Konto des
-- Fahrers und von dort in jeder seiner Tankungen.
--
-- Die Liste startet leer und wächst von selbst, wie carrier_companies und
-- unloading_companies: Trägt der Chef ein Kennzeichen ein, das noch nicht
-- drin ist, trägt die App es nach dem Speichern nach und beim nächsten
-- Fahrer steht es im Dropdown. Deshalb hier bewusst keine Platzhalter.
--
-- Gespeichert wird immer in Großbuchstaben (siehe
-- app/services/licensePlateService.ts) — passend zu den Konten, die
-- supabase/functions/create-driver ebenfalls in Großbuchstaben ablegt.
-- Sonst stünden "gr400fx" und "GR400FX" als zwei Einträge in der Liste.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.license_plates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.license_plates enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
--
-- Nur der Chef: Der Fahrer braucht die Liste nicht. Sein eigenes
-- Kennzeichen steht in seinem Konto, und die Auswahl in seiner Tankliste
-- baut sich aus seinen eigenen Tankeinträgen (app/driver/tankliste.tsx).
create policy "Boss can read license plates"
  on public.license_plates for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can add license plates"
  on public.license_plates for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

notify pgrst, 'reload schema';
