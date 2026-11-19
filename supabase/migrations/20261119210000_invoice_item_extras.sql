-- Zusatzzeile und Dieselzuschlag je Rechnungsposition.
--
-- Auf den Rechnungen der Firma steht je Ladung oft noch eine Zeile wie
-- "12 Stk. Europaletten getauscht" und ein Dieselzuschlag in Prozent mit
-- eigenem Betrag:
--
--     pauschal                    €  1.450,00
--     Dieselzuschlag 7 %          €    101,50
--
-- zusatztext:     freie Zeile über "pauschal"; leer = keine Zeile.
-- diesel_prozent: null = kein Zuschlag. Der Betrag wird nicht gespeichert,
--                 sondern aus preis * diesel_prozent / 100 gerechnet (auf
--                 Cent gerundet) — so kann er nie vom Prozentsatz abweichen.
--                 Er zählt zum Nettobetrag der Rechnung.
--
-- save_invoice (20261119140000_invoice_numbers_and_save.sql) schreibt die
-- beiden Felder jetzt mit; sonst unverändert, gleiche Signatur.
--
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.invoice_items
  add column if not exists zusatztext text not null default '',
  add column if not exists diesel_prozent numeric(5, 2);

alter table public.invoice_items
  drop constraint if exists invoice_items_diesel_prozent_check;

alter table public.invoice_items
  add constraint invoice_items_diesel_prozent_check
  check (diesel_prozent is null or (diesel_prozent >= 0 and diesel_prozent <= 100));

create or replace function public.save_invoice(
  p_invoice_id uuid,
  p_header jsonb,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
begin
  update public.invoices
     set belegnummer = p_header ->> 'belegnummer',
         rechnungsdatum = (p_header ->> 'rechnungsdatum')::date,
         empfaenger_name = p_header ->> 'empfaenger_name',
         empfaenger_strasse = p_header ->> 'empfaenger_strasse',
         empfaenger_ort = p_header ->> 'empfaenger_ort',
         kundennummer = p_header ->> 'kundennummer',
         uid_nummer = p_header ->> 'uid_nummer',
         ust_satz = (p_header ->> 'ust_satz')::numeric,
         zahlungsziel = p_header ->> 'zahlungsziel',
         netto_betrag = (p_header ->> 'netto_betrag')::numeric,
         ust_betrag = (p_header ->> 'ust_betrag')::numeric,
         end_betrag = (p_header ->> 'end_betrag')::numeric,
         updated_at = now()
   where id = p_invoice_id;

  if not found then
    raise exception 'Rechnung nicht gefunden' using errcode = 'no_data_found';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.invoice_items
       set position_datum = (v_item ->> 'position_datum')::date,
           bezeichnung = v_item ->> 'bezeichnung',
           transportnr = v_item ->> 'transportnr',
           ladestelle = v_item ->> 'ladestelle',
           ladedatum = (v_item ->> 'ladedatum')::date,
           entladestelle = v_item ->> 'entladestelle',
           entladedatum = (v_item ->> 'entladedatum')::date,
           preis = (v_item ->> 'preis')::numeric,
           zusatztext = coalesce(v_item ->> 'zusatztext', ''),
           diesel_prozent = (v_item ->> 'diesel_prozent')::numeric
     where id = (v_item ->> 'id')::uuid
       and invoice_id = p_invoice_id;

    if not found then
      raise exception 'Rechnungsposition nicht gefunden' using errcode = 'no_data_found';
    end if;
  end loop;
end;
$$;

revoke all on function public.save_invoice(uuid, jsonb, jsonb) from public;
revoke all on function public.save_invoice(uuid, jsonb, jsonb) from anon;
grant execute on function public.save_invoice(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
