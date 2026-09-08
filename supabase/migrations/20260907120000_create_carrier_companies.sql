-- Carrier companies ("Frachtführer"/Subunternehmer) that a boss can pick
-- from when filling in "An Firma" on a Fremdauftrag (external transport
-- order). The list grows on its own: whenever a boss types a company name
-- that isn't in here yet, the app adds it after the order is created, so it
-- shows up in the dropdown next time.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.carrier_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.carrier_companies enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
create policy "Boss can read carrier companies"
  on public.carrier_companies for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can add carrier companies"
  on public.carrier_companies for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

-- Seed data — no real customers captured yet, these are placeholders so the
-- dropdown isn't empty on first use. Replace/delete freely via the
-- Supabase dashboard once real carrier companies are known.
insert into public.carrier_companies (name) values
  ('Spedition Mustermann GmbH'),
  ('Voest Alpine Logistik'),
  ('Honisch Transporte GmbH'),
  ('Berger Spedition & Logistik')
on conflict (name) do nothing;
