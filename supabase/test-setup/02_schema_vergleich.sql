-- TRANSLOG PRO – Schema-Vergleich zwischen Echtprojekt und Test-Projekt.
--
-- Nur lesend, ändert nichts. In BEIDEN Projekten im SQL Editor ausführen und
-- die beiden Ergebnistabellen vergleichen: Gleiche Anzahl und gleicher
-- Fingerabdruck heißt, dieser Teil des Schemas ist identisch. Wo sie sich
-- unterscheiden, folgt eine Detail-Abfrage für genau diesen Bereich.
--
-- NOT-NULL-Constraints (contype 'n') bleiben außen vor: Neuere Postgres-
-- Versionen führen sie als eigene Zeilen, ältere nicht. Das ergäbe sonst
-- Unterschiede, die keine sind.

with
spalten as (
  select count(*) as n,
         md5(string_agg(format('%s.%s|%s|%s|%s', table_name, column_name, data_type,
                               is_nullable, coalesce(column_default, '')),
                        E'\n' order by table_name, column_name)) as h
    from information_schema.columns
   where table_schema = 'public'
),
constraints as (
  select count(*) as n,
         md5(string_agg(format('%s|%s|%s', conrelid::regclass, conname, pg_get_constraintdef(oid)),
                        E'\n' order by conrelid::regclass::text, conname)) as h
    from pg_constraint
   where connamespace = 'public'::regnamespace
     and contype <> 'n'
),
indizes as (
  select count(*) as n,
         md5(string_agg(format('%s|%s', indexname, indexdef), E'\n' order by indexname)) as h
    from pg_indexes
   where schemaname = 'public'
),
policies as (
  select count(*) as n,
         md5(string_agg(format('%s.%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, cmd,
                               roles::text, coalesce(qual, ''), coalesce(with_check, '')),
                        E'\n' order by schemaname, tablename, policyname)) as h
    from pg_policies
   where schemaname in ('public', 'storage')
),
funktionen as (
  select count(*) as n,
         md5(string_agg(format('%s(%s)|%s|%s|%s', p.proname, pg_get_function_identity_arguments(p.oid),
                               p.prosecdef, coalesce(p.proacl::text, ''), md5(p.prosrc)),
                        E'\n' order by p.proname, pg_get_function_identity_arguments(p.oid))) as h
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
),
trigger as (
  select count(*) as n,
         md5(string_agg(pg_get_triggerdef(t.oid), E'\n' order by t.tgrelid::regclass::text, t.tgname)) as h
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relnamespace = 'public'::regnamespace
     and not t.tgisinternal
),
rechte as (
  select count(*) as n,
         md5(string_agg(format('%s|%s|%s', table_name, grantee, privilege_type),
                        E'\n' order by table_name, grantee, privilege_type)) as h
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
),
buckets as (
  select count(*) as n,
         md5(string_agg(format('%s|%s|%s|%s', id, public, coalesce(file_size_limit::text, ''),
                               coalesce(allowed_mime_types::text, '')),
                        E'\n' order by id)) as h
    from storage.buckets
),
erweiterungen as (
  select count(*) as n,
         string_agg(extname, ', ' order by extname) as h
    from pg_extension
)
select '1 Spalten' as bereich, n as anzahl, left(h, 10) as fingerabdruck from spalten
union all select '2 Constraints', n, left(h, 10) from constraints
union all select '3 Indizes', n, left(h, 10) from indizes
union all select '4 Policies', n, left(h, 10) from policies
union all select '5 Funktionen', n, left(h, 10) from funktionen
union all select '6 Trigger', n, left(h, 10) from trigger
union all select '7 Tabellenrechte', n, left(h, 10) from rechte
union all select '8 Storage-Buckets', n, left(h, 10) from buckets
union all select '9 Erweiterungen', n, h from erweiterungen
order by bereich;
