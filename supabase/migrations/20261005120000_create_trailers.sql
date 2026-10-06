-- Die Auflieger der Firma. Anders als die LKW (license_plates) hängen sie
-- an nichts: kein Fahrer, kein LKW, keine Tankung. Der Chef will von ihnen
-- nur wissen, wann das Pickerl abläuft — erinnert wird wie beim LKW einen
-- Monat vorher (siehe 20261005110000_add_pickerl.sql).
--
--   plate             Kennzeichen, immer in Großbuchstaben (siehe
--                     app/services/trailerService.ts), damit "gr123ab" und
--                     "GR123AB" nicht zwei Auflieger werden.
--   description       Freitext, z. B. "Kühlauflieger Schmitz" — woran der
--                     Chef ihn auf dem Hof erkennt.
--   pickerl_due_date  Der Monat auf dem Pickerl als Datum; null heißt
--                     "nicht überwacht".
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.trailers (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  description text,
  pickerl_due_date date,
  created_at timestamptz not null default now()
);

alter table public.trailers enable row level security;

-- Nur der Chef — die Rolle aus public.profiles (20260915110000), nicht aus
-- dem JWT-user_metadata. Löschen darf er hier, anders als beim LKW: An
-- einem Auflieger hängen keine Tankungen, die verloren gehen könnten.
drop policy if exists "Boss can read trailers" on public.trailers;
create policy "Boss can read trailers"
  on public.trailers for select
  to authenticated
  using ((select public.app_role()) = 'boss');

drop policy if exists "Boss can add trailers" on public.trailers;
create policy "Boss can add trailers"
  on public.trailers for insert
  to authenticated
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can update trailers" on public.trailers;
create policy "Boss can update trailers"
  on public.trailers for update
  to authenticated
  using ((select public.app_role()) = 'boss')
  with check ((select public.app_role()) = 'boss');

drop policy if exists "Boss can delete trailers" on public.trailers;
create policy "Boss can delete trailers"
  on public.trailers for delete
  to authenticated
  using ((select public.app_role()) = 'boss');

notify pgrst, 'reload schema';
