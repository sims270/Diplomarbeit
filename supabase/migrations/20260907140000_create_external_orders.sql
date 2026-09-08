-- Fremdaufträge (Transportauftrag orders sent to external/subcontracted
-- carriers) — persisted so a boss can come back and edit one after
-- creating it, instead of it only living for the current session.
create extension if not exists pgcrypto with schema extensions;

-- Shared with orders.order_nr (see 20260907150000_create_orders.sql) so
-- eigene Aufträge and Fremdaufträge draw from the same running count —
-- "Nr. 5" never means two different jobs. Auto-assigns the next number
-- (1, 2, 3, ...) when a boss leaves the field blank; explicitly typing one
-- on create/edit overrides this default (see fieldsToRow in
-- externalOrderService.ts, which only sends order_nr to Postgres at all
-- when the form actually filled it in).
create sequence if not exists public.order_nr_seq start 1;

create table if not exists public.external_orders (
  id uuid primary key default gen_random_uuid(),
  order_nr text not null unique default nextval('public.order_nr_seq')::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),

  recipient_company text not null default '',
  recipient_contact text not null default '',

  loading_date date,
  loading_time_from text not null default '',
  loading_time_until text not null default '',
  loading_company text not null default '',
  loading_address text not null default '',
  loading_number text not null default '',
  cargo_description text not null default '',
  loading_meters text not null default '',

  unloading_date date,
  unloading_time_from text not null default '',
  unloading_time_until text not null default '',
  unloading_company text not null default '',
  unloading_address text not null default '',

  freight_rate text not null default '0,00',
  deadline_surcharge text not null default '0,00',

  vehicle_type text not null default '',
  notes text not null default '',

  license_plate text,
  driver_name text
);

alter table public.external_orders enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
create policy "Boss can read external orders"
  on public.external_orders for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can create external orders"
  on public.external_orders for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can edit external orders"
  on public.external_orders for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');
