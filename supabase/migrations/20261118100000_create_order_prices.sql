-- Vereinbarter Preis eines eigenen Auftrags — nur für den Chef.
--
-- Bewusst eine eigene Tabelle statt einer Spalte in orders: RLS wirkt auf
-- ganze Zeilen. Der Fahrer darf seine zugewiesenen Aufträge lesen und bekäme
-- damit jede Spalte von orders, auch wenn die App sie nicht anzeigt. Auf
-- diese Tabelle hat er gar keinen Zugriff.
--
-- Die Rechnung übernimmt den Preis beim Anlegen als Vorschlag (Edge Function
-- export-invoice); dort bleibt er änderbar.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

create table if not exists public.order_prices (
  order_id uuid primary key references public.orders(id) on delete cascade,
  preis numeric(12, 2) not null check (preis >= 0),
  updated_at timestamptz not null default now()
);

alter table public.order_prices enable row level security;

drop policy if exists "Boss can manage order prices" on public.order_prices;
create policy "Boss can manage order prices"
  on public.order_prices for all
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

notify pgrst, 'reload schema';
