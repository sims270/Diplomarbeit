# Security- & Code-Review – TRANSLOG PRO

**Stand:** 09.11.2026 (Nachprüfung des Reviews vom 25.09.2026) · **Branch:** `main` @ `8d9e7c5` (+ lokale Änderungen an `package.json`/`package-lock.json`)
**Geprüft:** `app/`, `components/`, `lib/`, `supabase/migrations/` (alle 37), `supabase/functions/` (alle 14 + `_shared`), `supabase/dashboard-deploy/` (Abgleich), `.github/workflows/`, Config-Dateien, Git-History auf Secrets, `npm audit --package-lock-only`.
**Nicht prüfbar:** Supabase-Projekteinstellungen (Auth, Rate-Limits) und Vercel-Projekteinstellungen (Env-Variablen, Header) liegen nicht im Repo. Befunde, die davon abhängen, sind mit **[unsicher]** markiert.

**Stack:** Expo / React Native (statischer Web-Export auf Vercel) + Supabase (Postgres mit RLS, Auth, Storage, Deno Edge Functions). Kein eigener Server – die Sicherheit hängt an **RLS-Policies** und **Edge Functions**.

---

## 1. Zusammenfassung

| | Anzahl | Punkte |
|---|---|---|
| ✅ Behoben | 1 | #1 |
| ⚠️ Teilweise | 4 | #2, #4, #9, #11 |
| ❌ Offen | 10 | #3, #5, #6, #7, #8, #10, #12, #13, #14, #15 |
| 🆕 Neu | 2 | #16, #17 |

Der kritische Befund #1 ist sauber behoben: Rollen stehen jetzt in `public.profiles`, alle Policies, `security definer`-Funktionen und Edge Functions prüfen über `app_role()` bzw. `getRole()`. Damit ist auch #2 weitgehend entschärft. **Offen ist kein kritischer Punkt mehr.** Die dringendsten Punkte sind jetzt:
1. **(#16, neu)** Das Kennzeichen des Fahrers steht weiter in `user_metadata`, das er selbst ändern kann. Damit verfälscht er die Umsatzliste und liest Tachostände fremder LKW.
2. **(#17, neu)** Löscht der Chef einen bereits verrechneten Auftrag, verschwindet die Position still aus der ausgestellten Rechnung.
3. **(#3)** Exporte und Listen brechen weiterhin still bei 1000 Zeilen ab.

Keine Secrets im Repo oder in der Git-History (`.env` war nie eingecheckt, `.env.example` enthält nur Platzhalter).

---

## 2. Übersicht aller Befunde

| Nr | Schweregrad | Status | Fundstelle | Kurzbeschreibung |
|----|-------------|--------|-----------|------------------|
| 1 | Kritisch | ✅ Behoben | `supabase/migrations/20260915110000_create_profiles.sql` | Rolle in `user_metadata` → jeder Fahrer wird Chef |
| 16 | **Mittel** | 🆕 Neu | `20260914120000_add_revenue_list.sql:45`, `20260930110000_odometer_readings.sql:139` | Kennzeichen in `user_metadata` steuert Umsatzliste und km-Vorschlag |
| 17 | **Mittel** | 🆕 Neu | `20261108100000_boss_delete_orders.sql:14-25`, `20260914130000_add_collective_invoices.sql:57` | Löschen eines verrechneten Auftrags entfernt die Rechnungsposition |
| 3 | **Mittel** | ❌ Offen | `export-tank-entries/index.ts:363`, `export-revenue-list/index.ts:203-215`, `invoiceService.ts:267-270`, `revenueListService.ts:39-45`, `tankEntryService.ts:148` | Abfragen ohne Paging, stiller Abbruch bei 1000 Zeilen |
| 4 | **Mittel** | ⚠️ Teilweise | `20260911110000_add_fleet_to_license_plates.sql:56,64-67` | Fahrer kann beliebige Kennzeichen und km-Stände eintragen |
| 5 | **Mittel** | ❌ Offen | `delete-driver/index.ts:47`, `20260909100000_create_tank_entries.sql:25`, `20260907150000_create_orders.sql:20-22` | Fahrer mit Daten lässt sich nicht löschen, Zugang bleibt aktiv |
| 2 | Niedrig [unsicher] | ⚠️ Teilweise | keine Auth-Config im Repo | Selbstregistrierung vermutlich an; Konto ohne Rolle hat aber kaum Zugriff |
| 6 | Niedrig | ❌ Offen | `20260930110000_odometer_readings.sql:61-65` | `complete_order` erlaubt erneutes Abschließen |
| 7 | Niedrig | ❌ Offen | `app/services/invoiceService.ts:393-425` | Rechnung wird nicht atomar gespeichert |
| 8 | Niedrig | ❌ Offen | `invoiceService.ts:401`, `20260910120000_create_invoices.sql` | Belegnummer frei änderbar, kein `unique` |
| 9 | Niedrig | ⚠️ Teilweise | `app/chef/_layout.tsx:11`, `app/context/AuthContext.tsx:185-187` | Rollen-Redirect da, aber kein Login-Guard; Offline-Sitzung fälschbar |
| 10 | Niedrig | ❌ Offen | z. B. `export-invoice/index.ts:969-971`, `list-drivers/index.ts:31-33`, `verify-boss.ts:60` | Rohe DB-/Auth-Fehler gehen an den Client |
| 11 | Niedrig | ⚠️ Teilweise | `create-driver/index.ts:47,56`, `update-driver/index.ts:80,87` | Fahrer-Functions ohne Typprüfung, Passwort min. 6 Zeichen |
| 12 | Niedrig | ❌ Offen | kein `vercel.json`, `lib/supabase.ts:36-42` | Keine Security-Header, Token im localStorage |
| 13 | Niedrig [unsicher] | ❌ Offen | `lib/offlineFallback.ts:34-38` | Offline-Fallback-Passwort steht im JS-Bundle (falls gesetzt) |
| 14 | Niedrig | ❌ Offen | `package-lock.json` | `npm audit`: 43 Meldungen (1 kritisch, 17 hoch), fast alle Build-Kette |
| 15 | Niedrig | ❌ Offen | `app/services/notificationService.ts:79`, `app/examples/`, `export-invoice/index.ts:354` | Toter WebSocket-Code, fehlende Migrationen |

---

## 3. Befunde im Detail

### #1 – Kritisch: Rolle in `user_metadata` – ✅ Behoben

**Fundstelle:** `supabase/migrations/20260915110000_create_profiles.sql`, `supabase/functions/_shared/verify-boss.ts:13-25,56-65`, `app/context/AuthContext.tsx:64-72`
**Prüfung:** Rolle steht in `public.profiles` (keine Schreib-Policy für Clients). Ein Abgleich aller Migrationen zeigt: Für **jede** Policy, die früher `user_metadata` las, gilt inzwischen die Fassung mit `(select public.app_role())`. `set_tank_entry_prices` und `update_tank_entry` prüfen ebenfalls `app_role()`. Alle Edge Functions holen die Rolle über `getRole()` aus `profiles`, auch die Dashboard-Fassungen. Der Client meldet Konten ohne Rolle ab (`AuthContext.tsx:148`).
**Rest:** Das Kennzeichen liegt noch in `user_metadata` → eigener Befund #16.

---

### #16 – Mittel 🆕: Fahrer kann sein Kennzeichen selbst ändern und damit Umsatzliste und km-Daten verfälschen

**Fundstelle:**
- `supabase/migrations/20260914120000_add_revenue_list.sql:45` (Trigger `snapshot_order_license_plate`)
- `supabase/migrations/20260930110000_odometer_readings.sql:139` (`get_suggested_start_odometer`)
- `supabase/functions/create-driver/index.ts:67`, `update-driver/index.ts:94-97`, `list-drivers/index.ts:53`

**Problem:** Das zugeteilte Kennzeichen steht in `user_metadata.license_plate`. Das Feld kann jeder angemeldete Nutzer selbst ändern (`supabase.auth.updateUser({ data: { license_plate: "XY-123" } })`). Zwei `security definer`-Funktionen lesen es aus `auth.users.raw_user_meta_data`:
- Beim Abschließen schreibt der Trigger dieses Kennzeichen fest in `orders.license_plate`. Umsatzliste und Statistik ordnen die Fahrt dann dem falschen LKW zu.
- `get_suggested_start_odometer()` gibt den letzten Tachostand **jedes beliebigen** LKW zurück, wenn der Fahrer dessen Kennzeichen einträgt. Die Funktion prüft außerdem keine Rolle, auch ein Konto ohne Profil (siehe #2) kann sie aufrufen.

**Fix:** Das Kennzeichen in eine Tabelle, die nur der Server schreibt, z. B. als Spalte in `profiles`:
```sql
alter table public.profiles add column if not exists license_plate text;
update public.profiles p
   set license_plate = nullif(upper(btrim(u.raw_user_meta_data ->> 'license_plate')), '')
  from auth.users u where u.id = p.id and p.role = 'driver';
-- snapshot_order_license_plate / get_suggested_start_odometer:
--   select p.license_plate from public.profiles p where p.id = ...
-- get_suggested_start_odometer zusätzlich:
--   ... where public.app_role() = 'driver' and ...
```
`create-driver`, `update-driver` und `list-drivers` (beide Fassungen) schreiben bzw. lesen dann `profiles.license_plate`, und `AuthContext.tsx:117` liest es von dort.

---

### #17 – Mittel 🆕: Löschen eines verrechneten Auftrags verändert ausgestellte Rechnungen

**Fundstelle:** `supabase/migrations/20261108100000_boss_delete_orders.sql:14-25`, `20260914130000_add_collective_invoices.sql:57` (`order_id … on delete cascade`), `20261005140000_invoice_external_orders.sql:29`, `app/services/orderService.ts:229-236`

**Problem:** Seit dem letzten Commit darf der Chef Aufträge löschen. `invoice_items` hängt per `on delete cascade` am Auftrag. Bei einem verrechneten Auftrag verschwindet deshalb die Rechnungsposition: Eine Sammelrechnung verliert still eine Zeile und damit Betrag, oder die Rechnung (mit vergebener Belegnummer) bleibt ganz ohne Position. Ausgestellte Rechnungen müssen 7 Jahre unverändert aufbewahrt werden (§ 132 BAO). Die Warnung im Dialog („samt Rechnung“) ändert daran nichts. Dazu bleiben hochgeladene CMR-Dateien des Auftrags im Bucket liegen. Weil die Storage-Policies den Auftrag voraussetzen, kann sie danach niemand mehr lesen.

**Fix:** Verrechnete Aufträge in der Datenbank vor dem Löschen schützen:
```sql
alter table public.invoice_items
  drop constraint if exists invoice_items_order_id_fkey,
  add constraint invoice_items_order_id_fkey
    foreign key (order_id) references public.orders(id) on delete restrict;
-- analog für external_order_id
```
Im Client den Fehlercode `23503` in „Auftrag ist bereits verrechnet und kann nicht gelöscht werden“ übersetzen. Vor dem Löschen eines Auftrags die Dateien aus `orders.cmr` per `storage.remove()` entfernen.

---

### #3 – Mittel: Stilles Abschneiden bei 1000 Zeilen – ❌ Offen

**Fundstelle:** `supabase/functions/export-tank-entries/index.ts:363-372`, `export-revenue-list/index.ts:203-215`, `app/services/invoiceService.ts:267-270`, `revenueListService.ts:39-45`, `tankEntryService.ts:148-152`

**Problem:** Unverändert. PostgREST liefert pro Abfrage höchstens 1000 Zeilen („Max rows“). Diese Abfragen lesen alles ohne `.range()`. Ab Zeile 1001 fehlen Tankungen im Excel-Export und Preise in der Umsatzliste. In `getBillableOrders` fehlen Einträge im Set „schon verrechnet“, verrechnete Aufträge erscheinen dann wieder als offen.

**Fix:** Hilfsfunktion mit Paging und überall verwenden:
```ts
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const PAGE = 1000; const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}
```
Abfragen brauchen dafür eine eindeutige Sortierung (z. B. zusätzlich `.order("id")`). Für `getBillableOrders` besser in der DB filtern (View oder RPC mit `not exists`).

---

### #4 – Mittel: Fahrer kann Fahrzeugstamm und km-Stände verfälschen – ⚠️ Teilweise

**Fundstelle:** `supabase/migrations/20260911110000_add_fleet_to_license_plates.sql:56,64-67`, Policy in `20260915110000_create_profiles.sql` („Driver can create own tank entries“)

**Behoben:** Nur noch Konten mit Rolle `driver` dürfen Tankungen anlegen, Fremdfahrer und rollenlose Konten nicht mehr. Der Chef kann Einträge über `update_tank_entry` korrigieren, der km-Stand am Fahrzeug wird dabei neu berechnet.
**Offen:** Ein Fahrer kann weiter jedes Kennzeichen und jeden km-Stand (bis ~2,1 Mrd.) eintragen. Der Trigger legt unbekannte Kennzeichen als neue Fahrzeuge an und übernimmt km-Sprünge per `greatest()`.

**Fix:** Im Trigger nur bekannte, aktive Fahrzeuge zulassen und unplausible Sprünge ablehnen, Trigger auf `before insert` umstellen:
```sql
select km_stand into v_km from public.license_plates
 where plate_key = new.license_plate_key and retired_at is null for update;
if not found then raise exception 'Unbekanntes Kennzeichen' using errcode = 'foreign_key_violation'; end if;
if v_km is not null and new.km_stand > v_km + 5000 then
  raise exception 'km-Stand unplausibel' using errcode = 'check_violation';
end if;
```
Dazu `check (entry_date <= current_date + 1)`.

---

### #5 – Mittel: Fahrer mit Daten lassen sich nicht löschen – ❌ Offen

**Fundstelle:** `supabase/functions/delete-driver/index.ts:47`, `20260909100000_create_tank_entries.sql:25`, `20260907150000_create_orders.sql:20-22`

**Problem:** Unverändert. `tank_entries.driver_id`, `orders.assigned_to` und `orders.created_by` verweisen ohne `on delete`-Regel auf `auth.users`. `deleteUser` scheitert, sobald der Fahrer getankt oder einen Auftrag hatte. Der Zugang eines ausgeschiedenen Fahrers bleibt damit aktiv. (Bei Fremdfahrern ist das gelöst: `release_storage_ownership` + `on delete set null`.)

**Fix:** Fahrer sperren statt löschen:
```ts
await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
```
Zusätzlich die Zeile in `profiles` auf eine Rolle ohne Rechte setzen oder löschen, dann greift die Sperre auch für noch gültige JWTs sofort.

---

### #2 – Niedrig [unsicher]: Öffentliche Registrierung vermutlich nicht abgeschaltet – ⚠️ Teilweise

**Fundstelle:** keine `supabase/config.toml`, keine Doku der Auth-Einstellung im Repo

**Behoben:** Ein selbst registriertes Konto hat keine Zeile in `profiles`. Damit greift keine Policy, und der Client meldet es sofort ab (`AuthContext.tsx:148,258`).
**Offen:** Ob „Allow new users to sign up“ aus ist, lässt sich nicht prüfen. Ein solches Konto könnte `get_suggested_start_odometer()` aufrufen (prüft keine Rolle, siehe #16) und unnötig Auth-Konten anlegen.

**Fix:** Im Supabase-Dashboard *Authentication → Sign In / Providers → „Allow new users to sign up“* ausschalten und in `supabase/config.toml` dokumentieren (`[auth] enable_signup = false`).

---

### #6 – Niedrig: Auftrag kann mehrfach abgeschlossen werden – ❌ Offen

**Fundstelle:** `supabase/migrations/20260930110000_odometer_readings.sql:61-65` (neue Fassung von `complete_order`)

**Problem:** Die Funktion prüft weiter nicht, ob der Auftrag schon `completed` ist. Ein Fahrer kann per `supabase.rpc('complete_order', …)` die Tachostände, `empty_km`/`freight_km` und `completed_at` eines längst verrechneten Auftrags überschreiben.

**Fix:**
```sql
if vorhandene.status = 'completed' then
  raise exception 'Auftrag ist bereits abgeschlossen' using errcode = 'check_violation';
end if;
```
Dazu eine Obergrenze, z. B. `unloading_odometer - start_odometer <= 5000`.

---

### #7 – Niedrig: Rechnung wird nicht atomar gespeichert – ❌ Offen

**Fundstelle:** `app/services/invoiceService.ts:393-425`

**Problem:** `saveInvoice` schickt Kopf und jede Position als eigenes Update per `Promise.all`. Scheitert eines, sind die anderen schon gespeichert.

**Fix:** RPC-Funktion `save_invoice(p_header jsonb, p_items jsonb)` mit `security invoker`, die alles in einer Transaktion schreibt.

---

### #8 – Niedrig: Doppelte Belegnummern möglich – ❌ Offen

**Fundstelle:** `app/services/invoiceService.ts:401`, `supabase/migrations/20260910120000_create_invoices.sql`

**Problem:** `belegnummer` ist frei überschreibbar, ohne `unique`. Rechnungsnummern müssen eindeutig sein (§ 11 UStG).

**Fix:**
```sql
create unique index if not exists invoices_belegnummer_key
  on public.invoices (belegnummer) where belegnummer is not null and belegnummer <> '';
```
Fehler `23505` im Client verständlich übersetzen.

---

### #9 – Niedrig: Routen-Guards im Frontend – ⚠️ Teilweise

**Fundstelle:** `app/chef/_layout.tsx:11`, `app/driver/_layout.tsx:18`, `app/external/_layout.tsx:11`, `app/context/AuthContext.tsx:185-187`

**Behoben:** Alle drei Layouts leiten eine fremde Rolle auf ihren eigenen Bereich um.
**Offen:** Ohne Anmeldung (`user === null`) gibt es keinen Redirect, `/chef` rendert dann die (leere) Oberfläche. Eine Offline-Sitzung aus dem localStorage wird weiter übernommen, ohne zu prüfen, ob der Fallback überhaupt aktiv ist. Daten schützt RLS trotzdem, deshalb nur Niedrig.

**Fix:**
```tsx
if (!isLoading && !user) return <Redirect href="/login" />;
```
und in `AuthContext.tsx:185`: `if (!restoredSession && storedOfflineUser && isOfflineFallbackConfigured())`.

---

### #10 – Niedrig: Interne Fehlermeldungen gehen an den Client – ❌ Offen

**Fundstelle:** z. B. `supabase/functions/export-invoice/index.ts:421-422,633,969-971`, `list-drivers/index.ts:31-33,42-44`, `delete-driver/index.ts:48-49`, `verify-boss.ts:60`, `create-driver/index.ts:87`

**Problem:** `error.message` von Postgres/Auth geht ungefiltert zurück und verrät Tabellen- und Constraint-Namen. Die neuen Fremdfahrer-Functions machen es genauso.

**Fix:** Details nur loggen (`console.error`), dem Client eine allgemeine Meldung mit Status 500 geben. Bekannte Fälle (`23505`, „already registered“) gezielt übersetzen.

---

### #11 – Niedrig: Fehlende Typprüfung, schwache Passwortregel – ⚠️ Teilweise

**Fundstelle:** `supabase/functions/create-driver/index.ts:38,47,56`, `update-driver/index.ts:79-80,86-87`

**Behoben:** Die neuen Functions (`update-external-driver`, `reset-external-driver-password`, `create-external-driver`) prüfen `typeof`. `create-boss` verlangt 8 Zeichen. Fremdfahrer-Passwörter sind zufällig (12 Zeichen, `crypto.getRandomValues`).
**Offen:** `create-driver`/`update-driver` rufen `licensePlate.trim()` ohne Typprüfung auf (`{"licensePlate": 5}` → unbehandelter 500er). Für Fahrer gelten weiter nur 6 Zeichen. `set_external_order_driver` begrenzt die Länge von Kennzeichen/Name nicht.

**Fix:** `typeof … === "string"` für alle Felder, Passwort-Mindestlänge 10 und im Dashboard *Authentication → Policies* „Leaked password protection“ einschalten. In der SQL-Funktion `length(p_license_plate) <= 15`, `length(p_driver_name) <= 100`.

---

### #12 – Niedrig: Keine Security-Header, Token im localStorage – ❌ Offen

**Fundstelle:** kein `vercel.json` im Repo, `lib/supabase.ts:36-42`

**Problem:** Es gibt kein CSP, keinen Clickjacking-Schutz (`frame-ancestors`), keine `Referrer-Policy`. Das Session-Token liegt im Web im localStorage. Eine konkrete XSS-Lücke gibt es nicht (siehe Abschnitt 4), die Header wären die zweite Verteidigungslinie. [unsicher] ob im Vercel-Dashboard Header gesetzt sind.

**Fix:** `vercel.json` mit `Content-Security-Policy` (`connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP vor dem Livegang testen.

---

### #13 – Niedrig [unsicher]: Offline-Fallback-Passwort ist öffentlich – ❌ Offen

**Fundstelle:** `lib/offlineFallback.ts:34-38`

**Problem:** Code unverändert. Ist `EXPO_PUBLIC_OFFLINE_FALLBACK_PASSWORD` im Build gesetzt, steht es im JS-Bundle und öffnet bei Netzfehlern die Chef-Oberfläche (ohne Daten, da kein JWT). In der lokalen `.env` ist es nicht gesetzt. Ob es in Vercel gesetzt ist, lässt sich aus dem Repo nicht prüfen.

**Fix:** In der Produktiv-Umgebung von Vercel nicht setzen, nur in einem eigenen Demo-Deployment.

---

### #14 – Niedrig: Bekannte Schwachstellen in Dependencies – ❌ Offen

**Fundstelle:** `package-lock.json`

**Problem:** `npm audit` meldet inzwischen **43** Probleme (vorher 29): 1 kritisch (`shell-quote`), 17 hoch (u. a. `ws`, `tar`, `postcss`, `node-forge`, `undici`, `@xmldom/xmldom`, `js-yaml`, `image-size`, `compression`). Fast alle stecken transitiv in der Expo-/Metro-Build- und Dev-Server-Kette. Im Browser-Bundle landen nur `expo-router` → `query-string` → `decode-uri-component` (DoS durch präparierte URL, trifft nur den eigenen Tab). `@supabase/supabase-js` 2.112.1 und `react` sind nicht betroffen.

**Fix:** `npx expo install --check`, danach `npm audit fix` (ohne `--force`). Mehrere Fixes brauchen ein Expo-SDK-Upgrade. `npm:exceljs@4.4.0` in den Edge Functions regelmäßig prüfen.

---

### #15 – Niedrig: Toter Code und Schema-Drift – ❌ Offen

**Fundstelle:** `app/services/notificationService.ts:79`, `app/context/NotificationContext.tsx`, `app/examples/`, `supabase/functions/export-invoice/index.ts:354`, `20260911150000_backfill_unloading_companies.sql:22`

**Problem:** Unverändert. Das ungenutzte Notification-System verbindet sich per `ws://` ohne Auth. Dateien unter `app/services/`, `app/context/`, `app/examples/` werden von Expo Router als Routen behandelt. `site_companies.bmd_kto_nr`/`uid_nummer` und `20260911140000_dedupe_company_names.sql` fehlen weiterhin in den Migrationen. Wer die DB aus dem Repo neu aufsetzt, bekommt ein anderes Schema.

**Fix:** Notification-Code löschen. `services/`, `context/` und `hooks/` aus `app/` in den Projekt-Root verschieben. Fehlende Migrationen per `supabase db diff` nachziehen.

---

## 4. Was bereits gut gelöst ist

- **Rollenmodell (#1):** `profiles` ohne Client-Schreibrechte, `app_role()` als `security definer` mit `(select …)`-Caching. Die Migration warnt selbst, falls noch eine Policy `user_metadata` liest.
- **Fremdfahrer-Zugänge:** Zugriff nur über eng begrenzte Funktionen ohne Preis-Spalten, Ablaufdatum wird in jeder Funktion und Storage-Policy geprüft. Das Klartext-Passwort wurde entfernt (`20261106100000`). `update` auf `external_driver_accounts` ist auf `expires_on`/`label` begrenzt.
- **`security definer`-Funktionen:** Alle haben `set search_path = public` und `revoke … from public, anon`. `create_invoice`, `can_write_order_documents` und `release_storage_ownership` sind auch für `authenticated` gesperrt.
- **RLS:** auf allen 13 Tabellen aktiv, neue Tabellen (`trailers`, `trailer_permits`) nur für den Chef.
- **CMR-Upload:** `add_order_document` prüft, dass die Datei im Ordner des Auftrags liegt und wirklich existiert.
- **Edge Functions:** Jede prüft serverseitig die Rolle des Aufrufers **und** des Ziel-Kontos. `delete-boss` verhindert Selbstlöschung und das Löschen des letzten Chefs. `handleLoad` validiert die UUID, bevor sie in einen `or()`-Filter geht.
- **Keine SQL-Injection, kein XSS:** nur Query-Builder und parametrisierte Funktionen. Alle Werte in den Druck-HTMLs (`document.write`) laufen durch `escapeHtml`, `dangerouslySetInnerHTML` nur für statisches CSS. Excel-Exporte schreiben Text als Zellwerte, nicht als Formeln.
- **Secrets:** `service_role` nur in Edge Functions, Keep-Alive-Workflow nutzt GitHub-Secrets, nichts in der Git-History.
- **CORS `*` auf den Edge Functions:** unkritisch, weil die Authentifizierung über den `Authorization`-Header läuft und nicht über Cookies. Rate-Limiting: Es gibt keine öffentlichen eigenen Endpunkte, Login-Versuche begrenzt Supabase Auth.
- **Passwort ändern** verlangt das aktuelle Passwort (`accountService.ts:30-37`).
