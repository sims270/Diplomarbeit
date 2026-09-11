-- Die vollständige Anschrift des Empfängers ("An Firma") auf dem
-- Transportauftrag.
--
-- Bisher stand dort nur der Firmenname. Auf dem Papier-Transportauftrag
-- steht der Empfänger aber mit Straße und Ort — so wie die Ladestelle
-- darunter auch. Ohne Anschrift ist der Auftrag als Schriftstück
-- unvollständig.
alter table public.external_orders
  add column if not exists recipient_address text not null default '';

-- Und dieselbe Anschrift je Frächter merken, damit sie nicht bei jedem
-- Auftrag neu getippt werden muss — genau wie bei den Ladestellen
-- (20260910100000_add_address_to_site_companies.sql). Ein Frächter hat
-- eine Geschäftsanschrift, nicht mehrere Standorte: Anders als bei
-- site_companies bleibt der Name hier deshalb die Identität, und das
-- bestehende UNIQUE auf name bleibt unangetastet.
alter table public.carrier_companies
  add column if not exists strasse text,
  add column if not exists plz text,
  add column if not exists ort text;

-- Zum Nachtragen der Anschrift an einem Frächter, der schon in der Liste
-- steht. Die Tabelle hatte bisher nur SELECT und INSERT — sie war eine
-- reine Nachschlageliste.
drop policy if exists "Boss can update carrier companies" on public.carrier_companies;

create policy "Boss can update carrier companies"
  on public.carrier_companies for update
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');

notify pgrst, 'reload schema';
