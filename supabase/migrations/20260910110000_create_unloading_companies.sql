-- Firmen an der Entladestelle ("Entladung") auf Auftrag und Fremdauftrag.
-- Bewusst eine eigene Liste neben site_companies: dort stehen die aus dem
-- Warenwirtschaftssystem importierten Kundenfirmen samt Adresse, die als
-- Ladestelle vorkommen — an der Entladestelle sind es andere Firmen, die
-- der Chef dort nicht mitscrollen will.
--
-- Die Liste startet leer und wächst von selbst, wie carrier_companies:
-- Tippt der Chef beim Auftrag eine Entladefirma ein, die noch nicht drin
-- ist, trägt die App sie nach dem Anlegen nach und beim nächsten Mal steht
-- sie im Dropdown. Deshalb hier bewusst keine Platzhalter-Firmen.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.unloading_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.unloading_companies enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
create policy "Boss can read unloading companies"
  on public.unloading_companies for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can add unloading companies"
  on public.unloading_companies for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

notify pgrst, 'reload schema';
