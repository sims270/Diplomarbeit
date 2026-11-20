-- TRANSLOG PRO – Schema-Vergleich, Detailstufe.
--
-- Nur lesend, ändert nichts. In BEIDEN Projekten ausführen. Eine Zeile je
-- Tabelle (Spalten, Constraints, Indizes, Rechte) und je Funktion, damit sich
-- die Unterschiede aus 02_schema_vergleich.sql einer Stelle zuordnen lassen.

with
spalten as (
  select table_name as objekt,
         count(*) as anzahl,
         left(md5(string_agg(format('%s|%s|%s|%s', column_name, data_type, is_nullable,
                                    coalesce(column_default, '')),
                             E'\n' order by column_name)), 6) as fp
    from information_schema.columns
   where table_schema = 'public'
   group by table_name
),
constraints as (
  select conrelid::regclass::text as objekt,
         count(*) as anzahl,
         left(md5(string_agg(format('%s|%s', conname, pg_get_constraintdef(oid)),
                             E'\n' order by conname)), 6) as fp
    from pg_constraint
   where connamespace = 'public'::regnamespace
     and contype <> 'n'
   group by conrelid
),
indizes as (
  select tablename as objekt,
         count(*) as anzahl,
         left(md5(string_agg(format('%s|%s', indexname, indexdef), E'\n' order by indexname)), 6) as fp
    from pg_indexes
   where schemaname = 'public'
   group by tablename
),
rechte as (
  select table_name as objekt,
         count(*) as anzahl,
         left(md5(string_agg(format('%s|%s', grantee, privilege_type),
                             E'\n' order by grantee, privilege_type)), 6) as fp
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
   group by table_name
),
funktionen as (
  select format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as objekt,
         1 as anzahl,
         left(md5(format('%s|%s|%s', p.prosecdef, coalesce(p.proacl::text, ''), p.prosrc)), 6) as fp
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
)
select 'Spalten' as bereich, objekt, anzahl, fp from spalten
union all select 'Constraints', objekt, anzahl, fp from constraints
union all select 'Indizes', objekt, anzahl, fp from indizes
union all select 'Rechte', objekt, anzahl, fp from rechte
union all select 'Funktion', objekt, anzahl, fp from funktionen
order by bereich, objekt;
