-- Genehmigungen der Auflieger. Welche ein Auflieger braucht, hängt vom
-- Land ab — deshalb eine eigene Tabelle mit beliebig vielen Zeilen je
-- Auflieger statt einer Spalte in public.trailers (20261005120000).
--
-- Wie beim Pickerl erinnert die App einen Monat vor Ablauf, damit Zeit
-- bleibt, die Genehmigung zu erneuern.
--
--   name         Freitext, z. B. "Deutschland" oder "Schweiz – Überbreite"
--                — woran der Chef erkennt, welche Genehmigung gemeint ist.
--   valid_until     Bis wann sie gilt.
--   validity_years  Wie lange eine Genehmigung gilt — je nach Land
--                   verschieden. Beim Erneuern rückt valid_until um so
--                   viele Jahre weiter (app/services/trailerService.ts).
--
-- Wird der Auflieger gelöscht, gehen seine Genehmigungen mit (on delete
-- cascade) — ohne Auflieger sind sie nichts wert.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.
create table if not exists public.trailer_permits (
  id uuid primary key default gen_random_uuid(),
  trailer_id uuid not null references public.trailers(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  valid_until date not null,
  created_at timestamptz not null default now()
);

-- Eigenes alter table statt in create table: So bekommt auch eine Tabelle
-- die Spalte, die schon mit der ersten Fassung dieser Datei angelegt wurde.
alter table public.trailer_permits
  add column if not exists validity_years integer not null default 1;

alter table public.trailer_permits
  drop constraint if exists trailer_permits_validity_years_check;

alter table public.trailer_permits
  add constraint trailer_permits_validity_years_check check (
    validity_years between 1 and 10
  );

create index if not exists trailer_permits_trailer_id_idx
  on public.trailer_permits (trailer_id);

alter table public.trailer_permits enable row level security;

-- Nur der Chef, wie bei den Aufliegern selbst.
drop policy if exists "Boss can read trailer permits" on public.trailer_permits;
create policy "Boss can read trailer permits"
  on public.trailer_permits for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add trailer permits" on public.trailer_permits;
create policy "Boss can add trailer permits"
  on public.trailer_permits for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can update trailer permits" on public.trailer_permits;
create policy "Boss can update trailer permits"
  on public.trailer_permits for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can delete trailer permits" on public.trailer_permits;
create policy "Boss can delete trailer permits"
  on public.trailer_permits for delete
  to authenticated
  using ((select public.app_role()) = 'boss');

notify pgrst, 'reload schema';
