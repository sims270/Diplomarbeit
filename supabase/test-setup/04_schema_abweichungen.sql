-- TRANSLOG PRO – Schema-Vergleich, Abweichungen im Einzelnen.
--
-- Nur lesend, ändert nichts. In BEIDEN Projekten ausführen. Zeigt genau die
-- Stellen, an denen 03_schema_details.sql Unterschiede gefunden hat:
--   A  Tabelle transportauftrag (nur im Echtprojekt): RLS, Zeilenzahl, Spalten
--   B  Spalten, Constraints und Indizes von carrier_companies und site_companies
--   C  Funktionen mit abweichendem Fingerabdruck: Rechte getrennt vom Code,
--      der Code ohne Kommentare und Leerraum. So fallen reine
--      Formatierungsunterschiede heraus.
--   D  normalize_company_name: vollständige Definition

with
t as (select to_regclass('public.transportauftrag') as oid),
fn(name) as (
  values ('add_order_document'), ('boss_confirm_external_order'),
         ('boss_reset_external_order_confirmation'), ('can_write_order_documents'),
         ('complete_external_order'), ('confirm_external_order'),
         ('convert_external_to_own_order'), ('convert_own_to_external_order'),
         ('delete_expired_external_drivers'), ('delete_tank_entry'),
         ('protect_external_order_confirmation'), ('remove_order_document'),
         ('save_invoice'), ('update_tank_entry'), ('withdraw_external_order')
)
select * from (
  -- A
  select 'A transportauftrag' as bereich, 'existiert' as objekt,
         (select (t.oid is not null)::text from t) as detail
  union all
  select 'A transportauftrag', 'rls_aktiv',
         (select c.relrowsecurity::text from pg_class c, t where c.oid = t.oid)
  union all
  select 'A transportauftrag', 'zeilen',
         case when (select oid from t) is not null then
           (xpath('/row/c/text()',
                  query_to_xml('select count(*) as c from public.transportauftrag', false, true, '')))[1]::text
         end
  union all
  select 'A transportauftrag', 'spalte ' || column_name,
         format('%s, null=%s, default=%s', data_type, is_nullable, coalesce(column_default, '-'))
    from information_schema.columns
   where table_schema = 'public' and table_name = 'transportauftrag'

  -- B
  union all
  select 'B ' || table_name, 'spalte ' || column_name,
         format('%s, null=%s, default=%s', data_type, is_nullable, coalesce(column_default, '-'))
    from information_schema.columns
   where table_schema = 'public' and table_name in ('carrier_companies', 'site_companies')
  union all
  select 'B ' || conrelid::regclass::text, 'constraint ' || conname, pg_get_constraintdef(oid)
    from pg_constraint
   where conrelid in ('public.carrier_companies'::regclass, 'public.site_companies'::regclass)
     and contype <> 'n'
  union all
  select 'B ' || tablename, 'index ' || indexname, indexdef
    from pg_indexes
   where schemaname = 'public' and tablename in ('carrier_companies', 'site_companies')

  -- C
  union all
  select 'C ' || p.proname, 'code',
         left(md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g')), 6)
    from pg_proc p join fn on fn.name = p.proname
   where p.pronamespace = 'public'::regnamespace
  union all
  select 'C ' || p.proname, 'rechte',
         format('secdef=%s, %s', p.prosecdef, coalesce(p.proacl::text, '-'))
    from pg_proc p join fn on fn.name = p.proname
   where p.pronamespace = 'public'::regnamespace

  -- D
  union all
  select 'D normalize_company_name', 'definition', pg_get_functiondef(p.oid)
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'normalize_company_name'
) x
order by bereich, objekt;
