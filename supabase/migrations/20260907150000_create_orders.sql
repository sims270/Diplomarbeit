-- "Eigene Aufträge" — internal transport jobs assigned to the company's own
-- drivers (as opposed to external_orders, which go to subcontracted
-- carriers). Same Transportauftrag-style layout as external_orders, minus
-- the recipient-company/legal-terms fields that only make sense once a job
-- leaves the company.
create extension if not exists pgcrypto with schema extensions;

-- Shares its numbering with external_orders.order_nr (same sequence,
-- created in 20260907140000_create_external_orders.sql) so eigene Aufträge
-- and Fremdaufträge never end up with the same number — "Nr. 5" always
-- means exactly one job, own or external. "if not exists" here is just a
-- safety net in case these migrations ever run out of order.
create sequence if not exists public.order_nr_seq start 1;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_nr text not null unique default nextval('public.order_nr_seq')::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),

  assigned_to uuid references auth.users(id),
  status text not null default 'pending',

  loading_date date,
  loading_time_from text not null default '',
  loading_time_until text not null default '',
  loading_company text not null default '',
  loading_address text not null default '',
  loading_meters text not null default '',

  unloading_date date,
  unloading_time_from text not null default '',
  unloading_time_until text not null default '',
  unloading_company text not null default '',
  unloading_address text not null default ''
);

alter table public.orders enable row level security;

-- Roles live in auth user_metadata (see supabase/functions/_shared/verify-boss.ts),
-- which Supabase mirrors into the JWT — no separate profiles table needed.
create policy "Boss can read all orders"
  on public.orders for select
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Driver can read own assigned orders"
  on public.orders for select
  to authenticated
  using (assigned_to = auth.uid());

create policy "Boss can create orders"
  on public.orders for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

create policy "Boss can edit orders"
  on public.orders for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');
