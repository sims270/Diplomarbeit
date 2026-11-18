# TRANSLOG PRO — technischer Überblick

Diplomarbeit (LSC - ITSolutions, HAK Judenburg): Transport-/Logistik-App für ein
Fuhrunternehmen — Aufträge, Fahrer, Fuhrpark, Tankliste, Rechnungen, plus
öffentliche Firmen-Website. Code-Kommentare und UI-Texte sind überwiegend Deutsch.

## Stack
- **Expo 54 / React Native 0.81 / React 19**, expo-router 6 (dateibasiertes Routing,
  `typedRoutes`, React Compiler an). Läuft nativ und im Web.
- **Web:** `web.output: "static"` → Screens werden in Node vorgerendert; kein
  `window` beim SSR (siehe Absicherung in `lib/supabase.ts`). Hosting auf Vercel.
- **Backend: nur Supabase** — Postgres mit RLS, Auth, Storage, Deno Edge Functions.
  Kein eigener Server; Sicherheit hängt an RLS-Policies und Edge Functions.
- Env: `.env` nach `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`, `..._ANON_KEY`,
  optional Offline-Fallback). `EXPO_PUBLIC_*` landet öffentlich im Bundle.
- Pfad-Alias `@/` = Projektwurzel. Lint: `npm run lint`. Keine Tests.

## Rollen & Auth
- Rolle steht in `public.profiles.role` (**nicht** `user_metadata`):
  `boss` → `/chef`, `driver` → `/driver`, `external_driver` → `/external`.
- `app/context/AuthContext.tsx`: Login, Rolle laden, `homeRouteFor()`. Layouts
  (`app/chef/_layout.tsx` usw.) leiten fremde Rollen um.
- Login per Benutzername: wird zu synthetischer E-Mail
  `<name>@accounts.translogpro.internal` — `lib/username.ts` und
  `supabase/functions/_shared/email.ts` müssen identisch bleiben.
- Offline-Fallback (`lib/offlineFallback.ts`), wenn Supabase unerreichbar ist;
  dann kein JWT → Edge Functions funktionieren nicht.

## Verzeichnisse
| Pfad | Inhalt |
|---|---|
| `app/business/` | Öffentliche Website (Start, Leistungen, Über uns, Kontakt, Impressum, Datenschutz) |
| `app/(auth)/login.tsx` | Login |
| `app/chef/(tabs)/` | Chef-Tabs: Dashboard, Listen (Tank/Umsatz), Profil |
| `app/chef/…` | Stack darüber: `order/` (eigene Aufträge), `external-order/` (Fremdaufträge), `drivers/`, `vehicles/` (LKW), `trailers/` (Auflieger + Genehmigungen), `invoices`, `reminders`, `account`, `bosses`, `map` |
| `app/driver/` | Fahrer: Aufträge, Tankliste, Karte, Profil |
| `app/external/` | Fremdfahrer-Zugang |
| `app/services/` | Ein Service je Fachobjekt mit allen Supabase-Zugriffen (Mapping DB ↔ camelCase-Interfaces); Kopfkommentar verweist auf die Migration der Tabelle |
| `components/` | Formulare (`OwnOrderForm`, `ExternalOrderForm`, `InvoiceForm`), `DashboardOrders`, `OrderPeriodFilter`, `ReminderGroups`, Website-Header/-Footer; `*.web.tsx` = Web-Varianten |
| `lib/` | PDF/Excel-Export (`transportauftrag*`, `ownOrder*`, `pdfLayout`, `briefkopfFont`), `invoiceTotals`, Datum/Monat, Datei-Picker, `motion/` (Reduce-Motion-Unterstützung) |
| `constants/` | `theme.ts` (Farbpalette light/dark), `translations.ts` (de/en, Zugriff über `useTranslation().t(section, key)`), `company.ts` (Team-Stammdaten), `ui-styles.ts` |
| `hooks/`, `contexts/` | Theme, Farbschema, Übersetzung, Erinnerungen; `settings-context` (Sprache) |

## Supabase
- `supabase/migrations/` — Schema-Historie (Zeitstempel-Präfix `YYYYMMDDHHMMSS_`).
- `supabase/functions/<name>/index.ts` — Edge Functions (Fahrer/Fremdfahrer/Chefs
  anlegen, ändern, löschen, auflisten; Export von Rechnung, Tankliste, Umsatzliste).
  Gemeinsame Helfer in `_shared/` (`cors`, `email`, `verify-boss`).
- `supabase/dashboard-deploy/<name>.ts` — dieselben Functions als **eigenständige
  Datei mit inline eingefügten `_shared`-Helfern** zum Einfügen im Dashboard-Editor.
  Wird aus der Repo-Fassung abgeleitet: bei Änderungen an einer Function **beide**
  Fassungen aktualisieren.
- Migrationen und Functions werden von Hand im Supabase-Dashboard eingespielt.
- `.github/workflows/`: Keep-Alive-Ping alle 3 Tage, damit das Free-Tier-Projekt
  nicht pausiert.

## Konventionen
- Neue Chef-Unterseite: Datei/Ordner unter `app/chef/` **und** `Stack.Screen` in
  `app/chef/_layout.tsx` eintragen; Unterordner bekommen ein eigenes `_layout.tsx`.
- UI-Texte nicht hart codieren, sondern in `constants/translations.ts` (de **und** en).
- Farben aus `Colors[scheme]` in `constants/theme.ts`, Dark Mode beachten.
- Kommentare erklären das *Warum*, meist auf Deutsch.

## Typische Fehler vermeiden
Diese Fehler sind hier schon passiert oder wären fast passiert. Vor jeder Änderung prüfen.

**Vor dem Planen**
- Doku und Reviews können veraltet sein: Jeden Befund gegen den aktuellen Code prüfen.
- Das Repo bildet die Datenbank nicht vollständig ab. Vor neuen Spalten das echte Schema
  erfragen, Kundendaten liegen etwa in `site_companies.bmd_kto_nr` und `uid_nummer`.
- Nur den verlangten Umfang umsetzen, Extras höchstens anbieten.

**Migrationen**
- Jede Migration muss mehrfach ausführbar sein: `if not exists`, `create or replace`,
  `drop policy if exists` vor `create policy`.
- Nachträge dürfen beim zweiten Lauf keine neueren Werte überschreiben (`where … is null`).
- Vor `create or replace function` die **neueste** Fassung in allen Migrationen suchen.
  Ändert sich die Signatur, die alte Überladung löschen, sonst scheitert PostgREST.
- Generierte Spalten wie `license_plate_key` sind in `before`-Triggern noch leer.
- Vor einem Unique-Index Altdaten prüfen und alle Stellen ansehen, die den Wert erzeugen
  (`create_invoice` vergibt Belegnummern selbst).
- Namen von Constraints nicht raten, sondern aus `pg_constraint` lesen.

**Sicherheit und Datenzugriff**
- Nichts Sicherheitsrelevantes aus `user_metadata` lesen, das kann jeder Nutzer selbst
  ändern. Rolle und Kennzeichen stehen in `public.profiles`.
- RLS verwirft Schreibzugriffe oft ohne Fehler: Bei `delete` und `update` die betroffenen
  Zeilen zurückholen und prüfen. `storage.remove()` meldet eine fehlende Berechtigung
  ebenfalls nicht.
- Der Chef darf im Bucket `order-documents` nichts löschen und nur Belege erledigter
  Aufträge lesen. Aufräumen läuft über eine Edge Function.
- PostgREST liefert höchstens 1000 Zeilen: Listen und Exporte mit `fetchAll` und
  eindeutiger Sortierung lesen (`lib/fetchAll.ts`, `_shared/fetch-all.ts`).
- Rohe Datenbank- und Auth-Fehler nie an den Client geben, sondern `internalError` nutzen.
  Erwartete Fehler als feste Kennung melden und in der UI übersetzen.

**Edge Functions**
- Immer beide Fassungen ändern (`functions/` und `dashboard-deploy/`). Neue Helfer aus
  `_shared/` müssen in der Dashboard-Fassung inline stehen.
- Simon spielt Functions von Hand ein: Auf `supabase/dashboard-deploy/<name>.ts` verweisen,
  nie auf `supabase functions deploy`.

**Web und Abhängigkeiten**
- `vercel.json` enthält eine CSP mit dem Hash des Inline-Skripts von Expo. Nach einem
  Expo-Update den Hash im Web-Build prüfen, neue externe Hosts in die CSP eintragen.
- `npx expo install --fix` kann auch `app.json` ändern: Danach den Diff ansehen.

**Abschluss und Übergabe**
- Es gibt keine Tests: `npx tsc --noEmit`, `npm run lint` und `npx expo export -p web`
  ausführen und klar sagen, was nicht getestet wurde.
- „Im Code behoben“ ist nicht „eingespielt“: Migrationen und Functions muss Simon einspielen.
- Die Reihenfolge nennen: Migrationen, dann Functions, dann App. Liest die App eine Spalte,
  die noch fehlt, kann das den Login blockieren.
- Der SQL Editor zeigt nur das Ergebnis der letzten Abfrage: Prüf-Abfragen einzeln ausgeben.
- Vor einem Commit `git status` und den Diff prüfen, Dateien gezielt hinzufügen und nichts
  mitnehmen, das als lokaler Workaround markiert ist.

## Weitere Doku
- `SECURITY_REVIEW.md` — Security-/Code-Review vom 25.09.2026 (Befund #1
  „Rolle in user_metadata“ ist inzwischen behoben).

