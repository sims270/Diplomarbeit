# Security- & Code-Review – TRANSLOG PRO

**Stand:** 25.09.2026 · **Branch:** `claude/sweet-darwin-v6mlu1`
**Geprüft:** `app/`, `components/`, `lib/`, `supabase/migrations/`, `supabase/functions/`, `supabase/dashboard-deploy/`, `.github/workflows/`, Config-Dateien, `package-lock.json` (per `npm audit`).
**Nicht möglich:** `expo lint` lief nicht, weil `node_modules` fehlt und installieren in dieser Phase nicht erlaubt war. Die Supabase-Projekteinstellungen (z. B. ob sich jeder selbst registrieren kann) liegen nicht im Repo. Befunde, die davon abhängen, sind mit **[unsicher]** markiert.

**Stack:** Expo / React Native (Web-Export als statische Seite, laut Kommentaren auf Vercel) + Supabase (Postgres mit Row Level Security, Auth, Storage, Deno Edge Functions). Einen eigenen Backend-Server gibt es nicht. Die gesamte Sicherheit hängt also an den **RLS-Policies** und den **Edge Functions**.

---

## 1. Zusammenfassung

Das Projekt ist sorgfältig gebaut: RLS ist überall aktiv, heikle Schreibvorgänge laufen über eng begrenzte `security definer`-Funktionen, und der service_role-Key bleibt auf dem Server. Es gibt aber **einen kritischen Konstruktionsfehler, der fast alle Schutzmaßnahmen aushebelt**: Die Rolle „boss“ steht in `user_metadata`, und dieses Feld darf **jeder angemeldete Benutzer selbst ändern**.
Die drei dringendsten Probleme:
1. **(#1)** Jeder Fahrer kann sich mit einer Zeile JavaScript selbst zum Chef machen und dann alles lesen und ändern, auch Fahrerkonten anlegen und löschen.
2. **(#2)** Ist in Supabase die Selbstregistrierung aktiv (Standard), kann sich jeder Fremde ein Konto anlegen, und zusammen mit #1 sofort Chef werden.
3. **(#3)** Exporte, Umsatzliste und die Auswahl „noch nicht verrechnet“ hören still bei 1000 Zeilen auf. Sobald so viele Daten da sind, entstehen falsche Excel-Dateien und falsche Rechnungslisten.

---

## 2. Übersicht aller Befunde

| Nr | Schweregrad | Kategorie | Datei:Zeile | Kurzbeschreibung |
|----|-------------|-----------|-------------|------------------|
| 1 | **Kritisch** | Autorisierung | `supabase/functions/_shared/verify-boss.ts:39`, alle Migrationen (z. B. `20260907150000_create_orders.sql:46`) | Rolle steht in `user_metadata`, das der Benutzer selbst ändern kann → jeder Fahrer wird Chef |
| 2 | **Hoch** [unsicher] | Authentifizierung | `lib/username.ts:1-4`, `.env.example:9` (keine Auth-Config im Repo) | Selbstregistrierung ist vermutlich nicht abgeschaltet → Fremde bekommen ein Konto |
| 3 | **Mittel** | Logik / Datenverlust | `supabase/functions/export-tank-entries/index.ts:193`, `export-revenue-list/index.ts:203-215`, `app/services/invoiceService.ts:227-234`, `revenueListService.ts:37-46`, `tankEntryService.ts:146` | Abfragen ohne Paging werden bei 1000 Zeilen still abgeschnitten |
| 4 | **Mittel** | Logik / Datenintegrität | `supabase/migrations/20260909100000_create_tank_entries.sql:91-94`, `20260911110000_add_fleet_to_license_plates.sql:44-72` | Fahrer kann beliebige Kennzeichen und km-Stände eintragen. Das verfälscht Fahrzeugstamm und Service-Anzeige dauerhaft |
| 5 | **Mittel** | Logik / Fehlerbehandlung | `supabase/migrations/20260909100000_create_tank_entries.sql:25`, `20260907150000_create_orders.sql:20-22`, `supabase/functions/delete-driver/index.ts:47` | Fahrer mit Tankeinträgen oder Aufträgen lässt sich nicht löschen (Fremdschlüssel ohne `on delete`) |
| 6 | **Niedrig** | Logik | `supabase/migrations/20260914100000_add_cargo_type_and_km.sql:75-101` | `complete_order` erlaubt erneutes Abschließen, Kilometer und `completed_at` werden nach der Verrechnung überschrieben |
| 7 | **Niedrig** | Konsistenz | `app/services/invoiceService.ts:258-297` | Rechnung wird in vielen Einzel-Updates gespeichert, nicht atomar |
| 8 | **Niedrig** | Buchhaltungslogik | `supabase/migrations/20260910140000_add_invoice_content.sql:20`, `invoiceService.ts:266` | Belegnummer frei änderbar, kein `unique`, doppelte Rechnungsnummern möglich |
| 9 | **Niedrig** | Autorisierung (Client) | `app/chef/_layout.tsx:4`, `app/driver/_layout.tsx`, `app/context/AuthContext.tsx:227-229` | Keine Routen-Guards. Die Chef-Oberfläche ist für jeden aufrufbar, die Offline-Sitzung lässt sich im localStorage fälschen |
| 10 | **Niedrig** | Informationspreisgabe | z. B. `supabase/functions/export-invoice/index.ts:846`, `list-drivers/index.ts:32`, `create-driver/index.ts:71-74` | Rohe Datenbank-/Auth-Fehlermeldungen gehen an den Client |
| 11 | **Niedrig** | Input-Validierung | `supabase/functions/update-driver/index.ts:132-133`, `create-driver/index.ts:47,56` | Keine Typprüfung (Absturz bei Nicht-String), Passwort-Mindestlänge nur 6 |
| 12 | **Niedrig** | Security-Header / Sessions | kein `vercel.json`, `lib/supabase.ts:36-42` | Keine CSP und keine Frame-Schutz-Header. Das Login-Token liegt im localStorage |
| 13 | **Niedrig** | Offline-Fallback | `lib/offlineFallback.ts:77`, `.env.example:21` | Fallback-Passwort steht im ausgelieferten JS-Bundle |
| 14 | **Niedrig** | Dependencies | `package-lock.json` | `npm audit`: 29 Meldungen (1 kritisch, 9 hoch), fast alle in Build-Tools |
| 15 | **Niedrig** | Toter Code / Schema-Drift | `app/services/notificationService.ts:77-85`, `app/examples/`, `supabase/functions/export-invoice/index.ts:286`, `20260911150000_backfill_unloading_companies.sql:22` | Unbenutztes WebSocket-System (`ws://`, ohne Auth), fehlende Migrationen für benutzte Spalten |

---

## 3. Befunde im Detail

### #1 – Kritisch: Jeder Benutzer kann sich selbst zum Chef machen

**Problem:** Supabase kennt zwei Metadaten-Felder pro Benutzer:
- `user_metadata`: darf **der Benutzer selbst** jederzeit ändern (`supabase.auth.updateUser({ data: … })`). Das ist dokumentiertes Verhalten.
- `app_metadata`: darf **nur der Server** (service_role) ändern.

Dieses Projekt speichert die Rolle in `user_metadata` und prüft sie überall: in **jeder** RLS-Policy, in den `security definer`-Funktionen und in `verifyBoss()` der Edge Functions.

**Angriffsszenario:** Ein Fahrer meldet sich normal an, öffnet im Browser die Entwicklertools (F12) und führt aus:
```js
await supabase.auth.updateUser({ data: { role: "boss" } });
await supabase.auth.refreshSession();
```
Ab jetzt steht `"role": "boss"` in seinem JWT. Er kann alle Aufträge, Fremdaufträge, Rechnungen, Tanklisten und CMR-Dokumente lesen und ändern. Über die Edge Functions kann er auch **Fahrerkonten anlegen, Passwörter anderer Fahrer ändern und Fahrer löschen**. Genauso kann er sein `license_plate` ändern. Der Trigger `snapshot_order_license_plate` übernimmt es dann in die Umsatzliste.

**Betroffener Code:**
```ts
// supabase/functions/_shared/verify-boss.ts:39
if (caller.user_metadata?.role !== "boss") {
```
```sql
-- z. B. supabase/migrations/20260907150000_create_orders.sql:43-46 (dasselbe Muster in allen Migrationen)
create policy "Boss can read all orders"
  on public.orders for select to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'boss');
```

**Fix:** Die Rolle (und das zugeteilte Kennzeichen) nach `app_metadata` verschieben und nur noch dort prüfen.

1. Neue Migration: bestehende Rollen kopieren, eine Hilfsfunktion anlegen und alle Policies darauf umstellen:
```sql
-- Rollen und Kennzeichen einmalig in app_metadata übernehmen
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object(
            'role', raw_user_meta_data ->> 'role',
            'license_plate', raw_user_meta_data ->> 'license_plate');

-- Eine zentrale Stelle für die Prüfung
create or replace function public.is_boss() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'boss'
$$;

-- Jede Policy neu anlegen, z. B.:
drop policy if exists "Boss can read all orders" on public.orders;
create policy "Boss can read all orders"
  on public.orders for select to authenticated
  using (public.is_boss());
-- … dasselbe für alle anderen Tabellen, die Storage-Policy "Boss reads documents…"
-- und in set_tank_entry_prices / update_tank_entry: if not public.is_boss() then raise …
```
2. `verify-boss.ts`:
```ts
if (caller.app_metadata?.role !== "boss") {
  return { error: "Only a boss account can do this", status: 403 };
}
```
3. `create-driver` / `update-driver` / `delete-driver` / `list-drivers`: `app_metadata: { role: "driver", license_plate: plate }` setzen bzw. lesen, nicht `user_metadata`.
4. `snapshot_order_license_plate` und der Nachtrag in `20260914120000_add_revenue_list.sql`: `raw_app_meta_data ->> 'license_plate'` lesen.
5. `AuthContext.tsx:192`: `session.user.app_metadata?.role` lesen (dort nur für die Anzeige).
6. Danach alle Benutzer einmal ab- und wieder anmelden lassen, damit ihr JWT die neue Rolle enthält.

---

### #2 – Hoch [unsicher]: Öffentliche Registrierung ist vermutlich nicht abgeschaltet

**Problem:** Laut `lib/username.ts:1-4` legt nur der Chef Konten an („never self-registered“). Im Repo gibt es aber keine `supabase/config.toml` und keinen Hinweis, dass im Dashboard „Allow new users to sign up“ ausgeschaltet wurde. In Supabase ist das standardmäßig **an**. URL und anon-Key stehen absichtlich im JS-Bundle (`.env.example:9-10`), also kann jeder `signUp` aufrufen.

**Angriffsszenario:** Ein Fremder ruft `supabase.auth.signUp({ email: "<eigene echte Adresse>", password: "…", options: { data: { role: "boss" } } })` auf, bestätigt die Mail und ist Chef (wegen #1). Auch nach dem Fix von #1 hätte er noch ein gültiges Konto. Damit darf er über `"Driver can create own tank entries"` Tankeinträge anlegen, und der Trigger legt dabei neue Fahrzeuge an (siehe #4).

**Betroffener Code:** Konfiguration fehlt. Kein Code zum Zeigen, darum [unsicher].

**Fix:** Im Supabase-Dashboard unter *Authentication → Sign In / Providers* **„Allow new users to sign up“ ausschalten**. Konten entstehen dann nur noch über `auth.admin.createUser` in `create-driver`. Zusätzlich die Einstellung im Repo dokumentieren, z. B. in `supabase/config.toml`:
```toml
[auth]
enable_signup = false
```
Als zweite Sicherung kann die Tankeintrag-Policy die Rolle verlangen:
```sql
with check (driver_id = auth.uid()
            and (auth.jwt() -> 'app_metadata' ->> 'role') = 'driver')
```

---

### #3 – Mittel: Stilles Abschneiden bei 1000 Zeilen

**Problem:** Supabase (PostgREST) liefert pro Abfrage standardmäßig höchstens 1000 Zeilen (Einstellung „Max rows“). Mehrere Abfragen lesen „alles“ ohne Paging. Ab Zeile 1001 fehlen Daten, **ohne Fehlermeldung**.

**Fehlerszenario:**
- Tankliste: Bei ~3 Tankungen pro Tag und 5 LKW ist die Grenze nach gut 2 Monaten erreicht. Danach fehlen im Excel-Export einfach Tankungen.
- `getBillableOrders()` lädt `invoice_items` ohne Limit. Ab 1000 Rechnungspositionen fehlen welche im Set `billed`. Bereits verrechnete Aufträge erscheinen dann wieder als „offen“. Der Server verhindert zwar die doppelte Rechnung (unique), aber der Chef bekommt eine falsche Liste und Fehlermeldungen.
- Umsatzliste (Client und Edge Function): Ab 1000 Einträgen fehlen Preise und Fahrten.

**Betroffener Code:**
```ts
// supabase/functions/export-tank-entries/index.ts:193
const { data, error: queryError } = await adminClient
  .from("tank_entries").select("…")
  .order("license_plate_key", { ascending: true })
  .order("entry_date", { ascending: true });   // kein Paging
```
```ts
// app/services/invoiceService.ts:233
supabase.from('invoice_items').select('order_id'),
```

**Fix:** Eine kleine Hilfsfunktion, die in 1000er-Schritten lädt, und überall dort verwenden:
```ts
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

// Verwendung
const rows = await fetchAll((from, to) =>
  adminClient.from("tank_entries").select("…")
    .order("license_plate_key").order("entry_date").order("id")
    .range(from, to));
```
Für `getBillableOrders` ist es besser, die Filterung in der Datenbank zu machen, z. B. per View oder `not.in`-Unterabfrage in einer RPC-Funktion. Dann muss nicht die ganze Tabelle `invoice_items` in den Browser.

---

### #4 – Mittel: Fahrer kann Fahrzeugstamm und km-Stände verfälschen

**Problem:** Beim Tankeintrag darf der Fahrer **jedes beliebige Kennzeichen** und **jeden km-Stand ≥ 0** eintragen (`int4`, also bis ~2,1 Mrd.). Der Trigger `sync_license_plate_km` übernimmt den Wert mit `greatest()` ins Fahrzeug, oder legt ein neues Fahrzeug an. Der Fahrer selbst kann das nicht rückgängig machen (keine UPDATE-Policy). Der Chef muss den Eintrag in der App korrigieren.

**Fehlerszenario:** Ein Tippfehler („3438900“ statt „343890“) oder Absicht auf ein fremdes Kennzeichen: Beim LKW steht dann ein km-Stand, der nie erreicht wird. `getServiceStatus` (`app/services/licensePlateService.ts:73-84`) meldet den Service sofort als fällig oder rechnet falsch. Mit Kennzeichen wie „X1“, „X2“ … lassen sich beliebig viele Fantasie-Fahrzeuge in der Chef-Übersicht erzeugen.

**Betroffener Code:**
```sql
-- 20260909100000_create_tank_entries.sql:91-94
create policy "Driver can create own tank entries"
  on public.tank_entries for insert to authenticated
  with check (driver_id = auth.uid());
```
```sql
-- 20260911110000_add_fleet_to_license_plates.sql:56,64-67
km_stand = greatest(coalesce(km_stand, 0), new.km_stand),
…
if not found then
  insert into public.license_plates (name, km_stand, …) values (upper(btrim(new.license_plate)), …)
```

**Fix:** Im Trigger nur **bekannte, aktive** Fahrzeuge zulassen und unplausible Sprünge ablehnen:
```sql
create or replace function public.sync_license_plate_km() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_km integer;
begin
  select km_stand into v_km from public.license_plates
   where plate_key = new.license_plate_key and retired_at is null
   for update;

  if not found then
    raise exception 'Unbekanntes Kennzeichen – bitte beim Chef melden'
      using errcode = 'foreign_key_violation';
  end if;

  -- Mehr als 5.000 km seit der letzten Tankung ist ein Tippfehler
  if v_km is not null and new.km_stand > v_km + 5000 then
    raise exception 'km-Stand unplausibel (letzter Stand: %)', v_km
      using errcode = 'check_violation';
  end if;

  update public.license_plates
     set km_stand = greatest(coalesce(km_stand, 0), new.km_stand),
         km_entry_date = case when new.km_stand >= coalesce(km_stand, 0) then new.entry_date else km_entry_date end,
         km_updated_at = now()
   where plate_key = new.license_plate_key;
  return new;
end $$;
```
Den Trigger dafür auf `before insert` umstellen, damit die Exception den Insert verhindert. Zusätzlich ein Check-Constraint `entry_date <= current_date + 1`, damit keine Tankungen in der Zukunft möglich sind.

---

### #5 – Mittel: Fahrer mit Daten lassen sich nicht löschen

**Problem:** `tank_entries.driver_id`, `orders.assigned_to` und `created_by` verweisen auf `auth.users(id)` **ohne `on delete`-Regel**. Standard ist dann `NO ACTION`: Postgres verweigert das Löschen eines Benutzers, auf den noch Zeilen zeigen.

**Fehlerszenario:** Der Chef löscht einen Fahrer, der schon getankt oder einen Auftrag hatte. `auth.admin.deleteUser` schlägt mit „Database error deleting user“ fehl. Der Chef sieht diese technische Meldung und kann ausgeschiedene Fahrer **nie** entfernen. Ihre Zugangsdaten bleiben gültig. Genau das ist bei ausgeschiedenen Mitarbeitern ein Sicherheitsrisiko.

**Betroffener Code:**
```sql
-- 20260909100000_create_tank_entries.sql:25
driver_id uuid not null references auth.users(id) default auth.uid(),
-- 20260907150000_create_orders.sql:20-22
created_by uuid references auth.users(id) default auth.uid(),
assigned_to uuid references auth.users(id),
```

**Fix:** Die Tankliste ist ein Fahrtenbuch, also dürfen die Daten nicht mitgelöscht werden. Deshalb Fahrer **sperren statt löschen**:
```ts
// delete-driver/index.ts: statt deleteUser
const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: "876000h", // ~100 Jahre = dauerhaft gesperrt
});
```
Alternativ die Fremdschlüssel auf `on delete set null` umstellen (dafür `driver_id` nullable machen). Dann geht aber die Zuordnung „wer hat getankt“ verloren.

---

### #6 – Niedrig: Auftrag kann mehrfach „abgeschlossen“ werden

**Problem:** `complete_order` prüft nicht, ob der Auftrag schon `completed` ist. Die App blendet den Button zwar aus, aber die Funktion ist direkt aufrufbar.

**Fehlerszenario:** Ein Fahrer ruft `supabase.rpc('complete_order', { order_id, empty_km: 0, freight_km: 9999 })` für einen längst verrechneten Auftrag auf. Kilometer und `completed_at` in der Umsatzliste ändern sich nachträglich.

**Betroffener Code:**
```sql
-- 20260914100000_add_cargo_type_and_km.sql:75-78
select o.* into vorhandene from public.orders o
 where o.id = complete_order.order_id
   and o.assigned_to = auth.uid();
```

**Fix:**
```sql
if vorhandene.status = 'completed' then
  raise exception 'Auftrag ist bereits abgeschlossen' using errcode = 'check_violation';
end if;
```
Zusätzlich eine sinnvolle Obergrenze, z. B. `check (empty_km <= 20000 and freight_km <= 20000)`.

---

### #7 – Niedrig: Rechnung wird nicht atomar gespeichert

**Problem:** `saveInvoice` schickt Kopf und jede Position als **eigenes** Update parallel ab. Schlägt eines fehl (z. B. ungültiges Datum oder Netzabbruch), sind die anderen schon gespeichert.

**Fehlerszenario:** Bei einer Sammelrechnung mit 4 Positionen werden 3 gespeichert, eine nicht. Der Chef sieht eine Fehlermeldung und druckt danach eine halb geänderte Rechnung.

**Betroffener Code:**
```ts
// app/services/invoiceService.ts:262-297
const results = await Promise.all([
  supabase.from('invoices').update({…}).eq('id', header.id),
  ...items.map((item) => supabase.from('invoice_items').update({…}).eq('id', item.id)),
]);
```

**Fix:** Eine RPC-Funktion, die alles in einer Transaktion schreibt:
```sql
create or replace function public.save_invoice(p_header jsonb, p_items jsonb)
returns void language plpgsql security invoker as $$
begin
  update public.invoices set belegnummer = p_header->>'belegnummer', … where id = (p_header->>'id')::uuid;
  update public.invoice_items i
     set preis = (x->>'preis')::numeric, bezeichnung = x->>'bezeichnung', …
    from jsonb_array_elements(p_items) x
   where i.id = (x->>'id')::uuid;
end $$;
```
`security invoker` heißt: Die bestehenden RLS-Policies greifen weiter, und bei einem Fehler wird alles zurückgerollt.

---

### #8 – Niedrig: Doppelte Belegnummern möglich

**Problem:** Die Nummer wird korrekt fortlaufend vergeben (`create_invoice` mit Advisory-Lock, das ist gut gemacht). Danach kann der Chef `belegnummer` aber frei überschreiben (`invoiceService.ts:266`), und auf der Spalte gibt es keinen `unique`-Constraint. Rechnungsnummern müssen in Österreich eindeutig sein (§ 11 UStG).

**Fehlerszenario:** Der Chef korrigiert Rechnung 05/2026 versehentlich auf „04/2026“. Es gibt zwei Rechnungen mit derselben Nummer, und niemand bemerkt es.

**Fix:**
```sql
create unique index if not exists invoices_belegnummer_key
  on public.invoices (belegnummer) where belegnummer is not null and belegnummer <> '';
```
Im Client den Fehlercode `23505` wie in `orderService.ts:141` in eine verständliche Meldung übersetzen.

---

### #9 – Niedrig: Keine Routen-Guards im Frontend

**Problem:** `app/chef/_layout.tsx` und `app/driver/_layout.tsx` prüfen weder Anmeldung noch Rolle. Jeder kann `/chef` direkt aufrufen. Dazu kommt: `AuthContext` übernimmt einen Offline-Benutzer aus dem localStorage **ohne zu prüfen**, ob der Offline-Fallback überhaupt eingeschaltet ist.

**Warum nur Niedrig:** Die echten Daten schützt der Server (RLS). Ohne gültiges Chef-JWT bleiben die Listen leer. Nach dem Fix von #1 sieht ein Fremder also nur eine leere Oberfläche. Trotzdem wirkt es unprofessionell und verrät die Struktur der Chef-Funktionen.

**Betroffener Code:**
```tsx
// app/chef/_layout.tsx:4
export default function ChefLayout() {
  const stackOptions = useStackScreenOptions();
  return (<Stack …>…</Stack>);
}
```
```ts
// app/context/AuthContext.tsx:227-229
if (!restoredSession && storedOfflineUser) {
  setOfflineUser(JSON.parse(storedOfflineUser) as AppUser);
```

**Fix:**
```tsx
// app/chef/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/app/context/AuthContext';

export default function ChefLayout() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const stackOptions = useStackScreenOptions();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (user?.role !== 'boss') return <Redirect href="/driver" />;
  return <Stack screenOptions={{ headerShown: false, ...stackOptions }}>…</Stack>;
}
```
(Analog für `driver/_layout.tsx`.) Und in `AuthContext.tsx`:
```ts
if (!restoredSession && storedOfflineUser && isOfflineFallbackConfigured()) {
```

---

### #10 – Niedrig: Interne Fehlermeldungen gehen an den Client

**Problem:** Die Edge Functions geben `error.message` von Postgres und Supabase-Auth ungefiltert zurück. Die App zeigt sie dann an (`toFriendlyError` in `orderService.ts:144` macht das ebenso für alles außer 23505).

**Szenario:** Meldungen wie `duplicate key value violates unique constraint "invoice_items_order_id_key"` oder `Database error deleting user` verraten Tabellen- und Constraint-Namen. Für einen Angreifer ist das eine Landkarte der Datenbank.

**Betroffener Code:**
```ts
// supabase/functions/export-invoice/index.ts:844-847
} catch (e) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  return json({ error: e instanceof Error ? e.message : "…" }, 400);
}
```

**Fix:** Details nur ins Log schreiben, dem Client eine allgemeine Meldung geben:
```ts
} catch (e) {
  if (e instanceof HttpError && e.status < 500) return json({ error: e.message }, e.status);
  console.error("[export-invoice]", e);
  return json({ error: "Interner Fehler – bitte später erneut versuchen." }, 500);
}
```
Dazu in `loadCompletedOrders`/`prefillInvoice` bei DB-Fehlern `new HttpError("Datenbankfehler", 500)` werfen statt `error.message` weiterzugeben.

---

### #11 – Niedrig: Fehlende Typprüfung und schwache Passwortregel

**Problem:**
- `update-driver` ruft `licensePlate.trim()` auf, ohne zu prüfen, ob es ein String ist. Schickt jemand `{"licensePlate": 5}`, stürzt die Funktion mit einem unbehandelten Fehler ab (HTTP 500).
- `username`/`password` werden ebenfalls nicht auf `typeof === "string"` geprüft.
- 6 Zeichen Mindestlänge ist für ein produktives Firmensystem zu wenig. Supabase bremst zwar Login-Versuche, aber schwache Passwörter bleiben das größte Einfallstor.

**Betroffener Code:**
```ts
// supabase/functions/update-driver/index.ts:132-133
if (licensePlate !== undefined) {
  const plate = licensePlate.trim().toUpperCase();
```

**Fix:**
```ts
if (licensePlate !== undefined && typeof licensePlate !== "string") {
  return json({ error: "licensePlate must be a string" }, 400);
}
if (password !== undefined && (typeof password !== "string" || password.length < 10)) {
  return json({ error: "Password must be at least 10 characters" }, 400);
}
```
Zusätzlich im Supabase-Dashboard unter *Authentication → Policies* eine Mindestlänge und „Leaked password protection“ einschalten.

---

### #12 – Niedrig: Keine Security-Header, Token im localStorage

**Problem:** Es gibt kein `vercel.json` mit Headern. Es fehlen Content-Security-Policy, `X-Frame-Options`/`frame-ancestors` (Schutz gegen Clickjacking) und `Referrer-Policy`. Das Supabase-Session-Token liegt im Web in `localStorage` (`lib/supabase.ts:36-42`, über AsyncStorage). Bei jeder XSS-Lücke könnte es direkt gestohlen werden. Eine konkrete XSS-Lücke habe ich **nicht** gefunden (siehe Abschnitt 4). Die Header sind also eine zweite Verteidigungslinie.

**Fix:** `vercel.json` im Projekt-Root:
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ]
  }]
}
```
Die CSP vor dem Livegang testen: Expo-Web kann Inline-Skripte brauchen. Dann gezielt Hashes ergänzen, nicht einfach `'unsafe-inline'` für Skripte freigeben.

---

### #13 – Niedrig: Offline-Fallback-Passwort ist öffentlich

**Problem:** `EXPO_PUBLIC_OFFLINE_FALLBACK_PASSWORD` landet im JS-Bundle. Die Kommentare sagen das ehrlich, und der Fallback greift nur bei Netzfehlern. Er gibt aber (mit Standard-Rolle `boss`) die Chef-Oberfläche frei. Wer das Bundle liest, kennt das Passwort.

**Fix:** Für die Produktivversion die Variable **nicht setzen**. Dann ist der Fallback aus. Der Fallback ist für Vorführungen gedacht und sollte nur in einem eigenen Demo-Deployment aktiv sein.

---

### #14 – Niedrig: Bekannte Schwachstellen in Dependencies

`npm audit --package-lock-only --omit=dev` meldet 29 Probleme (1 kritisch: `shell-quote`; hoch u. a.: `ws`, `postcss`, `tar`, `@xmldom/xmldom`, `js-yaml`, `nanoid`, `image-size`, `browserslist`, `brace-expansion`). Alle stecken **transitiv** in der Expo-/Metro-Build- und Dev-Server-Kette (z. B. `@expo/config-plugins`, `react-native/node_modules/ws`). In der ausgelieferten statischen Web-Seite laufen sie nicht, das Risiko betrifft vor allem den Entwickler-Rechner und den Build. Die direkten Laufzeit-Pakete (`@supabase/supabase-js` 2.112.1, `react` 19.1.0) sind nicht betroffen.

**Fix:** Vor dem Livegang `npx expo install --check` und danach `npm audit fix` (ohne `--force`) ausführen und anschließend neu testen. Die Edge Functions pinnen `npm:exceljs@4.4.0`. Die Version regelmäßig prüfen.

---

### #15 – Niedrig: Toter Code und Schema-Drift

- **Notification-System** (`app/services/notificationService.ts`, `app/context/NotificationContext.tsx`, `app/components/Notification*.tsx`, `app/examples/`): Es wird nirgends eingebunden außer im Beispiel. Es verbindet sich unverschlüsselt (`ws://localhost:8080`) und ohne Authentifizierung, nur mit der User-ID in der URL. Außerdem wird bei Expo Router **jede Datei unter `app/` zu einer Route**: `app/services/…`, `app/context/…` und `app/examples/…` sind damit als URLs erreichbar bzw. erzeugen Warnungen.
  **Fix:** Das Notification-System löschen oder vor einer echten Nutzung über Supabase Realtime (mit JWT) neu bauen. `services/`, `context/`, `components/`, `hooks/` aus `app/` in den Projekt-Root verschieben (es gibt dort schon `components/` und `hooks/`).
- **Fehlende Migrationen:** `export-invoice` liest `site_companies.bmd_kto_nr` und `uid_nummer` (`index.ts:286`), und `20260911150000_…sql:22` verweist auf `20260911140000_dedupe_company_names.sql`. Beides gibt es im Repo nicht, es wurde wohl nur im Dashboard angelegt. Wer die Datenbank aus den Migrationen neu aufsetzt (Backup-Wiederherstellung, Testumgebung), bekommt ein anderes Schema, und Kundennummer/UID bleiben leer.
  **Fix:** Das aktuelle Schema mit `supabase db diff` abgleichen und die fehlenden Migrationen nachziehen.
- `supabase/dashboard-deploy/` enthält Kopien der Functions. Das ist eine Fehlerquelle, weil ein Fix (z. B. #1) an zwei Stellen gemacht werden muss. Sobald die CLI eingerichtet ist, den Ordner löschen.

---

## 4. Was bereits gut gelöst ist

- **RLS überall aktiv**, und neue Tabellen haben bewusst keine zu weiten Policies. Tankliste und `orders` sind für Fahrer nicht direkt änderbar. Stattdessen gibt es eng begrenzte `security definer`-Funktionen (`complete_order`, `set_tank_entry_prices`, `update_tank_entry`) mit `set search_path = public` und sauberem `revoke … from public/anon`. Das ist Lehrbuch-Niveau.
- **service_role-Key** wird nur in Edge Functions verwendet. Im Frontend steht nur der anon-Key, und `.env` ist korrekt in `.gitignore`. Im Repo sind keine Secrets.
- **Rechnungsnummern:** `create_invoice` vergibt sie in einer Transaktion mit `pg_advisory_xact_lock`. Keine Race Condition, keine Lücken. Der `unique`-Constraint auf `invoice_items.order_id` verhindert Doppelverrechnung serverseitig.
- **Storage:** privater Bucket, Größenlimit, Whitelist für MIME-Typen (kein HTML/SVG), Rechte über den Ordnernamen. Dateinamen werden bereinigt (`toStorageName`), Downloads laufen über kurzlebige signierte URLs.
- **XSS:** Alle Benutzereingaben in den PDF-/Druck-HTMLs laufen durch `escapeHtml` (`lib/transportauftragPdf.ts`, `lib/ownOrderPdf.ts`). `dangerouslySetInnerHTML` wird nur für statisches CSS verwendet.
- **Keine SQL-Injection:** Alle Zugriffe gehen über den Supabase-Query-Builder oder parametrisierte PL/pgSQL-Funktionen. `ilike`-Platzhalter werden in `loadCustomer` sogar maskiert.
- **Geld und Datum:** `numeric` statt `float`, Zeitzone `Europe/Vienna` für Rechnungsdatum, Excel-Datumswerte zu Mittag verankert. Das sind typische Fehlerquellen, und hier sind sie richtig gelöst.
- **Doppeltes Absenden** ist in allen Formularen über `isSaving`/`busy` + `disabled` verhindert.
- `delete-driver`/`update-driver` prüfen serverseitig, dass das Ziel wirklich ein Fahrer ist, nicht ein Chef-Konto.
