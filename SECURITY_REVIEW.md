# Security- & Code-Review – TRANSLOG PRO (2. Durchlauf)

**Stand:** 25.09.2026 · **Geprüfter Commit:** `336d121` auf `main` (inkl. Merge von `fremdfahrer-zugang`)
**Geprüft:** `app/`, `components/`, `lib/`, `supabase/migrations/` (alle 27), `supabase/functions/` (9 Functions + `_shared`), `supabase/dashboard-deploy/`, Config-Dateien.
**Nicht möglich:** `expo lint` (kein `node_modules`, Installieren war nicht erlaubt). Supabase-Projekteinstellungen liegen nicht im Repo. Was davon abhängt, ist mit **[unsicher]** markiert.

---

## 1. Zusammenfassung

Es ist deutlich besser geworden: Die kritische Lücke aus dem ersten Review ist geschlossen. Rollen stehen jetzt in `public.profiles`, das kein Client schreiben darf, und **alle** Policies, Datenbankfunktionen und Edge Functions prüfen dort. Der neue Zugang für fremde Fahrer ist sauber abgeschottet (keine Preise, Ablaufdatum wird in jeder Funktion geprüft). Es gibt keinen kritischen oder hohen Befund mehr.
Die drei dringendsten verbleibenden Probleme:
1. **(#1)** Passwörter der fremden Fahrer stehen im Klartext in der Datenbank.
2. **(#2)** Das Kennzeichen steht noch in `user_metadata`. Ein Fahrer kann damit seine Fahrten in der Umsatzliste einem anderen LKW zuschreiben.
3. **(#3)** Abfragen ohne Paging brechen bei 1000 Zeilen ohne Fehlermeldung ab. Das betrifft Tankliste, Umsatzliste und die Liste „noch nicht verrechnet“.

### Vergleich zum ersten Review

| Alt | Thema | Status jetzt |
|-----|-------|--------------|
| #1 Kritisch | Rolle in `user_metadata` | ✅ **Behoben** (`profiles` + `app_role()`). Rest: Kennzeichen, siehe neuer #2 |
| #2 Hoch | Selbstregistrierung | ⬇️ **Entschärft** auf Niedrig: Ein Konto ohne `profiles`-Zeile sieht nichts mehr (neuer #13) |
| #3 Mittel | 1000-Zeilen-Grenze | ❌ Offen (neuer #3) |
| #4 Mittel | Tankliste: beliebige Kennzeichen/km | ⬇️ Teilweise: Nur noch Rolle `driver` darf eintragen. Plausibilitätsprüfung fehlt weiter (neuer #4) |
| #5 Mittel | Fahrer nicht löschbar | ❌ Offen, zusätzlich scheitert es jetzt auch an hochgeladenen Belegen (neuer #5) |
| #6 Niedrig | `complete_order` mehrfach | ❌ Offen (neuer #7). Bei fremden Fahrern ist es richtig gelöst |
| #7 Niedrig | Rechnung nicht atomar | ❌ Offen (neuer #8) |
| #8 Niedrig | Doppelte Belegnummern | ❌ Offen (neuer #9) |
| #9 Niedrig | Routen-Guards | ⬇️ Teilweise: Falsche Rolle wird umgeleitet, nicht Angemeldete nicht (neuer #10) |
| #10–#15 Niedrig | Fehlermeldungen, Validierung, Header, Offline-Passwort, Dependencies, toter Code | ❌ Offen (neue #11, #12, #14, #15, #16, #17) |

---

## 2. Übersicht aller Befunde

| Nr | Schweregrad | Kategorie | Datei:Zeile | Kurzbeschreibung |
|----|-------------|-----------|-------------|------------------|
| 1 | **Mittel** | Passwort-Speicherung | `supabase/migrations/20260915130000_external_driver_access.sql:49`, `supabase/functions/create-external-driver/index.ts:150-153` | **Neu:** Passwörter fremder Fahrer werden im Klartext gespeichert |
| 2 | **Mittel** | Autorisierung / Datenintegrität | `supabase/functions/create-driver/index.ts:67`, `supabase/migrations/20260914120000_add_revenue_list.sql:45` | **Neu (Rest von alt #1):** Kennzeichen in `user_metadata`, Fahrer kann es selbst ändern und die Umsatzliste verfälschen |
| 3 | **Mittel** | Logik / Datenverlust | `supabase/functions/export-tank-entries/index.ts:193`, `export-revenue-list/index.ts:203-215`, `app/services/invoiceService.ts:227-234`, `revenueListService.ts:37-46`, `tankEntryService.ts:146` | Abfragen ohne Paging brechen bei 1000 Zeilen ohne Meldung ab |
| 4 | **Mittel** | Datenintegrität | `supabase/migrations/20260911110000_add_fleet_to_license_plates.sql:44-72` | Fahrer kann beliebige Kennzeichen und unplausible km-Stände eintragen, die Fahrzeugliste wird dauerhaft verfälscht |
| 5 | **Mittel** | Logik / Fehlerbehandlung | `supabase/functions/delete-driver/index.ts:47`, `20260909100000_create_tank_entries.sql:25`, `20260907150000_create_orders.sql:20-22` | Eigene Fahrer mit Tankungen, Aufträgen oder Belegen lassen sich nicht löschen, ihr Zugang bleibt aktiv |
| 6 | **Niedrig** | Datenkonsistenz | `supabase/migrations/20260915120000_add_cmr_to_orders.sql:140-160` | **Neu:** `remove_order_document` trägt Belege aus `cmr` aus, ohne dass die Datei gelöscht wurde |
| 7 | **Niedrig** | Logik | `supabase/migrations/20260914100000_add_cargo_type_and_km.sql:75-101` | `complete_order` erlaubt erneutes Abschließen und überschreibt Kilometer nach der Verrechnung |
| 8 | **Niedrig** | Konsistenz | `app/services/invoiceService.ts:258-297` | Rechnung wird in vielen Einzel-Updates gespeichert, nicht in einem Schritt |
| 9 | **Niedrig** | Buchhaltungslogik | `supabase/migrations/20260910140000_add_invoice_content.sql:20` | Belegnummer frei änderbar ohne Eindeutigkeitsprüfung |
| 10 | **Niedrig** | Autorisierung (Client) | `app/chef/_layout.tsx:11`, `app/external/_layout.tsx:11`, `app/context/AuthContext.tsx:185-187` | ✅ **Behoben:** Nicht Angemeldete werden zum Login umgeleitet, gefälschte Offline-Sitzung wird verworfen |
| 11 | **Niedrig** | Informationspreisgabe | `supabase/functions/_shared/verify-boss.ts:60`, `export-invoice/index.ts:846`, `create-external-driver/index.ts:137,161` | Rohe Datenbank- und Auth-Fehlermeldungen gehen an den Client |
| 12 | **Niedrig** | Input-Validierung | `create-external-driver/index.ts:115-116`, `update-driver/index.ts`, `create-driver/index.ts:47`, `delete-driver/index.ts:43` | Keine Typprüfung (Absturz bei Nicht-String), Passwort-Mindestlänge 6, unbehandelter Fehler in `getRole` |
| 13 | **Niedrig** [unsicher] | Authentifizierung | keine Auth-Config im Repo | Selbstregistrierung vermutlich an. Harmlos geworden, aber unnötig offen |
| 14 | **Niedrig** | Migration | `supabase/migrations/20260915110000_create_profiles.sql:38-42` | **Neu:** Übernahme der Rollen vertraut dem alten, manipulierbaren `user_metadata` |
| 15 | **Niedrig** | Security-Header | kein `vercel.json`, `lib/supabase.ts:36-42` | ✅ **Behoben:** `vercel.json` mit CSP, `X-Frame-Options` u. a. (Token bleibt im localStorage, durch CSP abgesichert) |
| 16 | **Niedrig** | Offline-Fallback / Dependencies | `lib/offlineFallback.ts:77`, `package-lock.json` | Fallback-Passwort im JS-Bundle, `npm audit`: 29 Meldungen (fast alle in Build-Tools) |
| 17 | **Niedrig** | Toter Code / Schema-Drift | `app/services/notificationService.ts:77-85`, `app/examples/`, `export-invoice/index.ts:286` | Unbenutztes WebSocket-System (`ws://`, ohne Login), Spalten fehlen in den Migrationen |

---

## 3. Befunde im Detail

### #1 – Mittel (neu): Klartext-Passwörter der fremden Fahrer

**Problem:** Damit der Chef das Passwort erneut anzeigen kann, speichert `create-external-driver` es **unverschlüsselt** in `external_driver_accounts.password`. Normalerweise speichert man nur einen Hash, wie Supabase Auth es selbst macht.

**Warum gefährlich:** Jeder, der Zugriff auf die Tabelle bekommt, kennt sofort alle Passwörter aller aktiven Fremd-Zugänge. Das kann ein Chef-Konto mit schwachem Passwort sein, ein Datenbank-Backup, ein SQL-Export oder ein Screenshot im Supabase-Dashboard. Viele Menschen tippen das zugewiesene Passwort später auch woanders ein.

**Betroffener Code:**
```sql
-- 20260915130000_external_driver_access.sql:46-49
create table if not exists public.external_driver_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  password text not null,
```
```ts
// create-external-driver/index.ts:150-153
await adminClient.from("external_driver_accounts").insert({
  user_id: created.userId, username: created.username,
  password, …
```

**Fix:** Das Passwort nicht speichern, sondern bei Bedarf **neu setzen**. Das Passwort wird zufällig erzeugt (gut gemacht), also kann der Chef statt „anzeigen“ einfach „neues Passwort erzeugen“ drücken:
```ts
// neue Edge Function reset-external-driver-password
const { adminClient, error, status } = await verifyBoss(req);
if (error || !adminClient) return json({ error }, status ?? 401);
if ((await getRole(adminClient, userId)) !== "external_driver") {
  return json({ error: "Not an external driver" }, 403);
}
const password = randomPassword();
const { error: updErr } = await adminClient.auth.admin.updateUserById(userId, { password });
if (updErr) return json({ error: "Passwort konnte nicht gesetzt werden" }, 500);
return json({ password }); // nur einmal anzeigen, nirgends speichern
```
```sql
alter table public.external_driver_accounts drop column if exists password;
```
`getAccessPassword` in `app/services/externalDriverAccessService.ts:114` und der Button in `components/ExternalAccessPanel.tsx:134` rufen dann diese Function auf.

---

### #2 – Mittel (neu, Rest von alt #1): Kennzeichen in `user_metadata`

**Problem:** Die Rolle ist jetzt sicher, aber das zugeteilte **Kennzeichen** steht weiterhin in `user_metadata`. Das kann jeder Benutzer selbst ändern. Der Trigger `snapshot_order_license_plate` liest genau dieses Feld, wenn ein Auftrag abgeschlossen wird, und schreibt es fest in `orders.license_plate`. Die Umsatzliste gruppiert danach.

**Angriffsszenario:** Ein Fahrer führt in den Browser-Entwicklertools `supabase.auth.updateUser({ data: { license_plate: "GR400FX" } })` aus und schließt dann seinen Auftrag ab. Die Fahrt und ihr Umsatz landen in der Umsatzliste beim LKW eines Kollegen. Die Nachkalkulation pro Fahrzeug stimmt nicht mehr, und niemand bemerkt es.

**Betroffener Code:**
```ts
// supabase/functions/create-driver/index.ts:63-68
await adminClient.auth.admin.createUser({
  email: usernameToEmail(username), password, email_confirm: true,
  user_metadata: { license_plate: plate },
});
```
```sql
-- 20260914120000_add_revenue_list.sql:45-48
select nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
  into new.license_plate
  from auth.users u where u.id = new.assigned_to;
```

**Fix:** Das Kennzeichen in `profiles` speichern, wo nur der Server schreiben darf:
```sql
alter table public.profiles add column if not exists license_plate text;

update public.profiles p
   set license_plate = nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
  from auth.users u
 where u.id = p.id and p.role = 'driver' and p.license_plate is null;

create or replace function public.snapshot_order_license_plate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.license_plate is null and new.assigned_to is not null then
    select p.license_plate into new.license_plate
      from public.profiles p where p.id = new.assigned_to;
  end if;
  return new;
end $$;
```
In `create-driver`, `update-driver` und `list-drivers` dann `profiles.license_plate` schreiben bzw. lesen statt `user_metadata`. In `AuthContext.tsx:117` das Kennzeichen aus `profiles` mitladen (`select('role, license_plate')`).

---

### #3 – Mittel: Stilles Abschneiden bei 1000 Zeilen (unverändert)

**Problem:** Supabase liefert pro Abfrage standardmäßig höchstens 1000 Zeilen („Max rows“). Mehrere Stellen lesen „alles“ ohne Paging, und ab Zeile 1001 fehlen Daten **ohne Fehlermeldung**.

**Fehlerszenario:** Bei ~3 Tankungen pro Tag und 5 LKW ist die Grenze nach gut 2 Monaten erreicht. Danach fehlen im Excel-Export Tankungen. Ab 1000 Rechnungspositionen zeigt `getBillableOrders()` bereits verrechnete Aufträge wieder als „offen“ an. Die Umsatzliste verliert Preise.

**Betroffener Code:**
```ts
// supabase/functions/export-tank-entries/index.ts:193
const { data, error: queryError } = await adminClient
  .from("tank_entries").select("…")
  .order("license_plate_key", { ascending: true })
  .order("entry_date", { ascending: true });   // kein .range() → max. 1000
```
```ts
// app/services/invoiceService.ts:233
supabase.from('invoice_items').select('order_id'),
```

**Fix:** In 1000er-Schritten laden:
```ts
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

const rows = await fetchAll((from, to) =>
  adminClient.from("tank_entries").select("…")
    .order("license_plate_key").order("entry_date").order("id")
    .range(from, to));
```
Für `getBillableOrders` ist es besser, in der Datenbank zu filtern (RPC mit `where not exists (select 1 from invoice_items …)`). Dann muss nicht die ganze Tabelle in den Browser.

---

### #4 – Mittel: Fahrer kann Fahrzeugliste und km-Stände verfälschen (teilweise verbessert)

**Problem:** Seit `create_profiles` dürfen nur noch Konten mit Rolle `driver` tanken, das ist gut. Ein Fahrer darf aber weiterhin **jedes beliebige Kennzeichen** und **jeden km-Stand** (bis ~2,1 Mrd.) eintragen. Der Trigger übernimmt den Wert mit `greatest()` dauerhaft ins Fahrzeug oder legt ein neues Fahrzeug an.

**Fehlerszenario:** Ein Tippfehler („3438900“ statt „343890“) setzt den km-Stand des LKW für immer zu hoch. `getServiceStatus` (`app/services/licensePlateService.ts:73-84`) meldet dann den Service sofort als fällig oder rechnet falsch. Mit ausgedachten Kennzeichen entstehen Fantasie-LKW in der Chef-Übersicht.

**Betroffener Code:**
```sql
-- 20260911110000_add_fleet_to_license_plates.sql:56,64-67
km_stand = greatest(coalesce(km_stand, 0), new.km_stand),
…
if not found then
  insert into public.license_plates (name, km_stand, …) values (upper(btrim(new.license_plate)), …)
```

**Fix:** Den Trigger auf `before insert` umstellen und nur bekannte, aktive LKW mit plausiblem Sprung zulassen:
```sql
create or replace function public.sync_license_plate_km() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_km integer;
begin
  select km_stand into v_km from public.license_plates
   where plate_key = new.license_plate_key and retired_at is null for update;
  if not found then
    raise exception 'Unbekanntes Kennzeichen – bitte beim Chef melden' using errcode = 'foreign_key_violation';
  end if;
  if v_km is not null and new.km_stand > v_km + 5000 then
    raise exception 'km-Stand unplausibel (letzter Stand: %)', v_km using errcode = 'check_violation';
  end if;
  update public.license_plates
     set km_entry_date = case when new.km_stand >= coalesce(km_stand, 0) then new.entry_date else km_entry_date end,
         km_stand = greatest(coalesce(km_stand, 0), new.km_stand),
         km_updated_at = now()
   where plate_key = new.license_plate_key;
  return new;
end $$;

drop trigger if exists tank_entries_sync_license_plate_km on public.tank_entries;
create trigger tank_entries_sync_license_plate_km
  before insert on public.tank_entries
  for each row execute function public.sync_license_plate_km();
```

---

### #5 – Mittel: Eigene Fahrer lassen sich nicht löschen (verschärft)

**Problem:** `tank_entries.driver_id`, `orders.assigned_to` und `created_by` verweisen ohne `on delete`-Regel auf `auth.users`. Postgres verweigert dann das Löschen. **Neu dazugekommen:** Für fremde Fahrer wird vor dem Löschen `release_storage_ownership` aufgerufen, für eigene Fahrer in `delete-driver` nicht. Supabase lehnt aber das Löschen eines Kontos ab, dem noch Dateien im Storage gehören. Dasselbe Problem ist also bei den fremden Fahrern gelöst und bei den eigenen nicht.

**Fehlerszenario:** Ein Fahrer kündigt. Der Chef drückt „Löschen“ und bekommt „Database error deleting user“. Das Konto mit gültigem Passwort bleibt bestehen, der ehemalige Mitarbeiter kann sich weiter anmelden und seine alten Aufträge und CMR-Belege sehen.

**Betroffener Code:**
```ts
// supabase/functions/delete-driver/index.ts:43-47
if ((await getRole(adminClient, userId)) !== "driver") { … }
const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
```

**Fix:** Die Tankliste ist ein Fahrtenbuch, deshalb eigene Fahrer **sperren statt löschen**, und zusätzlich die Rolle entziehen:
```ts
// delete-driver/index.ts
const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: "876000h", // ~100 Jahre = dauerhaft gesperrt
});
if (banError) return json({ error: "Fahrer konnte nicht gesperrt werden" }, 500);
await adminClient.from("profiles").delete().eq("id", userId); // sofort kein Zugriff mehr
```
In `list-drivers` gesperrte Konten (`u.banned_until`) als „ausgeschieden“ kennzeichnen.

---

### #6 – Niedrig (neu): `cmr` kann von den echten Dateien abweichen

**Problem:** `remove_order_document` trägt einen Pfad aus `orders.cmr` bzw. `external_orders.cmr` aus, prüft aber nicht, ob die Datei wirklich aus dem Bucket gelöscht wurde. Ein Fahrer oder fremder Fahrer kann die Funktion direkt aufrufen, solange der Auftrag offen ist.

**Fehlerszenario:** Ein fremder Fahrer ruft `supabase.rpc('remove_order_document', { order_id, path })` auf. Die Datei bleibt im Bucket, fehlt aber in `cmr`. Laut Kommentar in `orderDocumentService.ts:84-86` fällt genau so ein Beleg „bei der Abrechnung durchs Raster“.

**Betroffener Code:**
```sql
-- 20260915120000_add_cmr_to_orders.sql:147-154
if not public.can_write_order_documents(remove_order_document.order_id, true) then …
update public.orders o
   set cmr = array_remove(o.cmr, remove_order_document.path)
 where o.id = remove_order_document.order_id;
```

**Fix:** Nur austragen, wenn die Datei nicht mehr existiert:
```sql
if exists (select 1 from storage.objects so
            where so.bucket_id = 'order-documents' and so.name = remove_order_document.path) then
  raise exception 'Datei ist noch vorhanden – zuerst löschen' using errcode = 'check_violation';
end if;
```
Noch sauberer ist ein Trigger `after delete on storage.objects`, der `cmr` selbst nachführt. Dann kann der Client die Spalte gar nicht mehr falsch setzen.

---

### #7 – Niedrig: Eigener Auftrag kann mehrfach „abgeschlossen“ werden (unverändert)

**Problem:** `complete_order` prüft nicht, ob der Auftrag schon `completed` ist. Bei `complete_external_order` ist das korrekt gelöst (`and e.status <> 'completed'`).

**Fehlerszenario:** Ein Fahrer ruft `supabase.rpc('complete_order', { order_id, empty_km: 0, freight_km: 9999 })` für einen längst verrechneten Auftrag auf. Kilometer und Datum in der Umsatzliste ändern sich nachträglich.

**Betroffener Code:**
```sql
-- 20260914100000_add_cargo_type_and_km.sql:75-78
select o.* into vorhandene from public.orders o
 where o.id = complete_order.order_id and o.assigned_to = auth.uid();
```

**Fix:**
```sql
if vorhandene.status = 'completed' then
  raise exception 'Auftrag ist bereits abgeschlossen' using errcode = 'check_violation';
end if;
```
Dazu eine sinnvolle Obergrenze, z. B. `check (empty_km <= 20000 and freight_km <= 20000)`.

---

### #8 – Niedrig: Rechnung wird nicht atomar gespeichert (unverändert)

**Problem und Szenario:** `saveInvoice` schickt Kopf und jede Position als eigenes Update ab. Scheitert eines, sind die anderen schon gespeichert, und der Chef druckt eine halb geänderte Sammelrechnung.

**Betroffener Code:**
```ts
// app/services/invoiceService.ts:262-297
const results = await Promise.all([
  supabase.from('invoices').update({…}).eq('id', header.id),
  ...items.map((item) => supabase.from('invoice_items').update({…}).eq('id', item.id)),
]);
```

**Fix:** Eine RPC-Funktion mit `security invoker`. Dann greifen die RLS-Policies weiter, und bei einem Fehler wird alles zurückgerollt:
```sql
create or replace function public.save_invoice(p_header jsonb, p_items jsonb)
returns void language plpgsql security invoker as $$
begin
  update public.invoices set belegnummer = p_header->>'belegnummer', …
   where id = (p_header->>'id')::uuid;
  update public.invoice_items i
     set preis = (x->>'preis')::numeric, bezeichnung = x->>'bezeichnung', …
    from jsonb_array_elements(p_items) x
   where i.id = (x->>'id')::uuid;
end $$;
```

---

### #9 – Niedrig: Doppelte Belegnummern möglich (unverändert)

**Problem und Szenario:** `create_invoice` vergibt die Nummer korrekt fortlaufend. Der Chef kann `belegnummer` danach aber frei überschreiben, und es gibt keinen `unique`-Constraint. Schreibt er versehentlich eine schon vergebene Nummer hinein, existieren zwei Rechnungen „04/2026“. Rechnungsnummern müssen aber eindeutig sein (§ 11 UStG).

**Fix:**
```sql
create unique index if not exists invoices_belegnummer_key
  on public.invoices (belegnummer) where belegnummer is not null and belegnummer <> '';
```
Im Client den Fehlercode `23505` wie in `orderService.ts:141` in eine verständliche Meldung übersetzen.

---

### #10 – Niedrig: Routen-Guards unvollständig (teilweise verbessert)

**Problem:** Die Layouts leiten jetzt eine **falsche Rolle** um, das ist neu und gut. Ist aber gar niemand angemeldet (`user === null`), wird die Oberfläche trotzdem angezeigt. Außerdem übernimmt `AuthContext` einen Offline-Benutzer aus dem localStorage, ohne zu prüfen, ob der Offline-Fallback überhaupt eingeschaltet ist.

**Warum nur Niedrig:** Die Daten schützt RLS, der Besucher sieht nur leere Listen. Trotzdem verrät die Oberfläche, welche Chef-Funktionen es gibt.

**Betroffener Code:**
```tsx
// app/chef/_layout.tsx:11
if (!isLoading && user && user.role !== 'boss') {
  return <Redirect href={homeRouteFor(user.role)} />;
}
```
```ts
// app/context/AuthContext.tsx:185-187
if (!restoredSession && storedOfflineUser) {
  setOfflineUser(JSON.parse(storedOfflineUser) as AppUser);
```

**Fix:**
```tsx
if (isLoading) return null;
if (!user) return <Redirect href="/login" />;
if (user.role !== 'boss') return <Redirect href={homeRouteFor(user.role)} />;
```
(Analog in `app/driver/_layout.tsx` und `app/external/_layout.tsx`.) In `AuthContext.tsx:185` zusätzlich `&& isOfflineFallbackConfigured()` prüfen.

---

### #11 – Niedrig: Interne Fehlermeldungen gehen an den Client

**Problem und Szenario:** Die Edge Functions geben `error.message` von Postgres und Supabase Auth ungefiltert zurück. `verifyBoss` liefert bei einem DB-Fehler sogar die rohe Meldung mit Status 500 (`verify-boss.ts:60`). Meldungen wie `duplicate key value violates unique constraint "…"` verraten Tabellen- und Constraint-Namen, also eine Landkarte der Datenbank.

**Betroffener Code:**
```ts
// supabase/functions/_shared/verify-boss.ts:59-61
} catch (roleError) {
  return { error: (roleError as Error).message, status: 500 };
}
```
```ts
// supabase/functions/create-external-driver/index.ts:159-162
if (profileError || accountError) {
  await adminClient.auth.admin.deleteUser(created.userId);
  return json({ error: (profileError ?? accountError)!.message }, 500);
}
```

**Fix:** Details ins Log, eine allgemeine Meldung an den Client:
```ts
} catch (roleError) {
  console.error("[verifyBoss]", roleError);
  return { error: "Interner Fehler – bitte später erneut versuchen.", status: 500 };
}
```

---

### #12 – Niedrig: Fehlende Typprüfung, schwache Passwortregel, unbehandelte Fehler

**Problem:**
- `create-external-driver/index.ts:115-116` ruft `body.label?.trim()` auf. Ist `label` eine Zahl, stürzt die Function mit einer unbehandelten Exception ab. Dasselbe gilt für `licensePlate` in `update-driver`.
- `delete-driver/index.ts:43` ruft `getRole()` ohne `try/catch` auf. `getRole` wirft bei DB-Fehlern (`verify-boss.ts:23`), das Ergebnis ist dann ein unbehandelter 500er. `delete-external-driver` macht es richtig (`index.ts:220-224`).
- Eigene Fahrer: Mindestlänge 6 Zeichen (`create-driver/index.ts:47`). Die Passwörter der fremden Fahrer werden dagegen sicher erzeugt (12 Zeichen, `crypto.getRandomValues`, ohne Modulo-Verzerrung).
- `expiresOn` hat keine Obergrenze. „Zeitlich begrenzt“ lässt sich mit `2099-12-31` aushebeln.

**Fix:**
```ts
if (typeof body.label !== "string" || typeof body.expiresOn !== "string") {
  return json({ error: "Ungültige Eingabe" }, 400);
}
const maxDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
if (expiresOn > maxDate) return json({ error: "Höchstens 90 Tage" }, 400);
```
```ts
// delete-driver/index.ts
let role: string | null;
try { role = await getRole(adminClient, userId); }
catch { return json({ error: "Interner Fehler" }, 500); }
```
Mindestlänge in `create-driver`/`update-driver` auf 10 anheben, zusätzlich im Supabase-Dashboard unter *Authentication → Policies* „Leaked password protection“ einschalten.

---

### #13 – Niedrig [unsicher]: Selbstregistrierung vermutlich an (entschärft)

**Problem:** Im Repo gibt es keine `supabase/config.toml`, und in Supabase ist „Allow new users to sign up“ standardmäßig an. **Neu:** Ein selbst registriertes Konto hat keine `profiles`-Zeile, und dann greift keine einzige Policy mehr (alle verlangen eine Rolle). `AuthContext.tsx:148` meldet so ein Konto sogar sofort wieder ab. Übrig bleibt: Fremde können beliebig viele Leer-Konten anlegen (Spam) und würden jede zukünftige Policy ausnutzen, die nur `auth.uid()` prüft.

**Fix:** Im Supabase-Dashboard unter *Authentication → Sign In / Providers* „Allow new users to sign up“ ausschalten und im Repo dokumentieren:
```toml
# supabase/config.toml
[auth]
enable_signup = false
```

---

### #14 – Niedrig (neu): Rollen-Übernahme vertraut dem alten `user_metadata`

**Problem:** Die Migration kopiert die Rollen aus `raw_user_meta_data`. Genau dieses Feld konnte bis zu dieser Migration jeder Benutzer selbst setzen (alt #1). Hat ein Fahrer das vorher ausgenutzt, wird er dabei **dauerhaft als `boss`** in `profiles` übernommen.

**Betroffener Code:**
```sql
-- 20260915110000_create_profiles.sql:38-42
insert into public.profiles (id, role)
select id, raw_user_meta_data ->> 'role'
  from auth.users
 where raw_user_meta_data ->> 'role' in ('boss', 'driver')
on conflict (id) do nothing;
```

**Fix:** Nach dem Einspielen einmal im SQL Editor prüfen. Es darf nur das echte Chef-Konto herauskommen:
```sql
select u.email, p.role, p.created_at
  from public.profiles p join auth.users u on u.id = p.id
 where p.role = 'boss';
```
Taucht ein unbekanntes Konto auf: `update public.profiles set role = 'driver' where id = '<id>';` und das Passwort dieses Kontos zurücksetzen.

---

### #15 – Niedrig: Keine Security-Header, Token im localStorage (unverändert)

**Problem:** Es gibt kein `vercel.json`, also keine Content-Security-Policy und keinen Schutz gegen Einbetten in fremde Seiten (Clickjacking). Das Login-Token liegt im Web im localStorage. Eine konkrete XSS-Lücke habe ich **nicht** gefunden. Die Header sind eine zweite Verteidigungslinie für den Fall, dass eine entsteht.

**Fix:** `vercel.json` im Projekt-Root:
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }]
}
```
Vor dem Livegang testen. Braucht Expo-Web Inline-Skripte, gezielt Hashes ergänzen statt `'unsafe-inline'` für Skripte.

---

### #16 – Niedrig: Offline-Passwort im Bundle, Dependencies (unverändert)

- `EXPO_PUBLIC_OFFLINE_FALLBACK_PASSWORD` (`lib/offlineFallback.ts:77`) landet im ausgelieferten JavaScript und gibt bei Netzfehlern die Chef-Oberfläche frei. **Fix:** Im Produktiv-Deployment die Variable nicht setzen, nur in einem eigenen Demo-Deployment.
- `npm audit --omit=dev`: 29 Meldungen (1 kritisch `shell-quote`, 9 hoch u. a. `ws`, `postcss`, `tar`). Alle stecken transitiv in der Expo-/Metro-Build-Kette, nicht in der ausgelieferten statischen Seite. `package.json` und `package-lock.json` haben sich seit dem ersten Review nicht geändert. **Fix:** `npx expo install --check`, danach `npm audit fix` (ohne `--force`) und neu testen.

---

### #17 – Niedrig: Toter Code und Schema-Drift (unverändert)

- Das **Notification-System** (`app/services/notificationService.ts`, `app/context/NotificationContext.tsx`, `app/components/Notification*.tsx`, `app/examples/`) wird nirgends eingebunden. Es verbindet sich unverschlüsselt (`ws://localhost:8080`) und ohne Login, nur mit der User-ID in der URL. Bei Expo Router wird außerdem jede Datei unter `app/` zu einer Route. **Fix:** löschen, und `services/`, `context/`, `components/`, `hooks/` aus `app/` in den Projekt-Root verschieben.
- `export-invoice` liest `site_companies.bmd_kto_nr` und `uid_nummer`, und `20260911150000_…sql:22` verweist auf `20260911140000_dedupe_company_names.sql`. Beides fehlt im Repo, eine neu aufgesetzte Datenbank hätte ein anderes Schema. **Fix:** `supabase db diff` ausführen und die fehlenden Migrationen nachziehen.
- `supabase/dashboard-deploy/` enthält Kopien aller Functions, inzwischen auch mit angepasster Rollenprüfung. Jeder Fix muss an zwei Stellen gemacht werden. **Fix:** Supabase CLI einrichten und den Ordner löschen.

---

## 4. Was bereits gut gelöst ist

- **Rollen in `public.profiles`** mit `app_role()` als `security definer` und ohne Schreib-Policy für Clients. Alle alten Policies wurden mit gleichem Namen neu angelegt, und die Migration warnt selbst, falls irgendwo noch `user_metadata` gelesen wird. Das ist vorbildlich.
- **Fremde Fahrer sind sauber abgeschottet:** keine Select-Policy auf `external_orders`, sondern `get_my_external_orders()` mit ausgewählten Spalten ohne Preise. Das Ablaufdatum wird in **jeder** Funktion und Storage-Policy geprüft (Wiener Zeit), `complete_external_order` verhindert doppeltes Abschließen. Spaltenrechte (`grant update (expires_on, label)`) verhindern, dass Benutzername oder Passwort über die API geändert werden.
- **Zufallspasswörter** mit `crypto.getRandomValues`, verwechslungsfreiem Alphabet und korrekt vermiedener Modulo-Verzerrung.
- **`add_order_document`** prüft, dass der Pfad genau im Ordner des Auftrags liegt und die Datei wirklich existiert. Damit lässt sich keinem Auftrag eine fremde Datei unterschieben.
- **Aufräumen bei Fehlern:** Scheitert das Anlegen von Profil oder Zugang, wird das Auth-Konto wieder gelöscht. Scheitert das Vermerken eines Belegs, wird die hochgeladene Datei wieder entfernt.
- Weiterhin gut: RLS überall aktiv, service_role nur serverseitig, keine Secrets im Repo, konsequentes `escapeHtml` in den PDF-Vorlagen, keine SQL-Injection (nur Query-Builder und parametrisierte Funktionen), Rechnungsnummern mit Advisory-Lock, `numeric` für Geld, Wiener Zeitzone für Datumswerte, Schutz vor doppeltem Absenden in allen Formularen.
