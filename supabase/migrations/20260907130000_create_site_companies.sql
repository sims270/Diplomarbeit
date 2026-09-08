-- Companies at the loading/unloading site ("Ladestelle"/"Entladestelle") on
-- a Fremdauftrag — distinct from carrier_companies (who *carries* the
-- goods) since this is *where* they're picked up/dropped off. One shared
-- list: the same site can be an origin in one order and a destination in
-- another. Grows on its own the same way carrier_companies does.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.site_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.site_companies enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
create policy "Boss can read site companies"
  on public.site_companies for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can add site companies"
  on public.site_companies for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

-- Seed data — no real sites captured yet, these are placeholders so the
-- dropdown isn't empty on first use. Replace/delete freely via the
-- Supabase dashboard once real loading/unloading sites are known.
insert into public.site_companies (name) values
  ('Voestalpine Stahl GmbH'),
  ('Honisch Metallbau GmbH'),
  ('Mustermann Baustoffe GmbH')
on conflict (name) do nothing;
