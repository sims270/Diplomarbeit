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
| `components/` | Formulare (`OwnOrderForm`, `ExternalOrderForm`, `InvoiceForm`), `TodayOrders`, `ReminderGroups`, Website-Header/-Footer; `*.web.tsx` = Web-Varianten |
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

## Weitere Doku
- `SECURITY_REVIEW.md` — Security-/Code-Review vom 25.09.2026 (Befund #1
  „Rolle in user_metadata“ ist inzwischen behoben).
