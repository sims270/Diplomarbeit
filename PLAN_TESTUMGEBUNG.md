# Plan: Testumgebung neben dem Echtbetrieb (TRANSLOG PRO)

**Status:** Vorschlag zur Besprechung im Team, Stand 18.11.2026. Es wurde noch nichts umgesetzt, weder im Code noch bei Supabase oder Vercel.

**Kurz gesagt:** Das Unternehmen arbeitet auf `lsc-itsolutions.net` mit der echten Datenbank. Wir testen auf `test.lsc-itsolutions.net` und auf localhost mit einer zweiten, kostenlosen Datenbank voller erfundener Daten. Die beiden Welten berühren sich nicht, und das Unternehmen sieht von den Tests nichts.

Die offenen Fragen für unsere Besprechung stehen am Ende unter „Zu besprechen“.

## Context
Das Unternehmen soll die Software produktiv nutzen, während das Projektteam weiter Änderungen testet. Testdaten dürfen im Echtbetrieb weder sichtbar sein noch etwas verändern.

Eine Trennung innerhalb der echten Datenbank scheidet aus: Testdaten würden Belegnummern und Transportnummern verbrauchen, km-Stände anheben und in Firmenlisten, Fahrerlisten und Excel-Exporten auftauchen (Exporte umgehen RLS per Service-Role).

**Entscheidung:** zwei getrennte Supabase-Projekte, alles in Gratis-Tarifen, Nutzung nur im Browser, Zugang für das ganze Projektteam.

## Zielbild

| | Echtbetrieb | Test |
|---|---|---|
| Adresse | `lsc-itsolutions.net` | `test.lsc-itsolutions.net` |
| Git-Branch | `main` | `test` |
| Vercel-Umgebung | Production | Preview |
| Supabase | bestehendes Projekt | neues Gratis-Projekt |
| `EXPO_PUBLIC_APP_ENV` | nicht gesetzt | `test` |
| Daten | echt | erfunden, jederzeit neu erzeugbar |

## Schritte

### 1. Code auf Branch `test` (Claude)
Der aktuelle, nicht committete Arbeitsstand kommt auf den neuen Branch `test`, **nicht** auf `main`. Ein Push auf `main` würde sofort den Echtbetrieb deployen, bevor die Migrationen eingespielt sind.

- **Banner:** neue Komponente `components/TestEnvironmentBanner.tsx`, eingebunden in `RootContent` in `app/_layout.tsx`. Sie erscheint nur bei `EXPO_PUBLIC_APP_ENV === "test"`. Texte in `constants/translations.ts` (de und en), Farben aus `Colors[scheme]`.
- **Localhost-Sperre:** `lib/supabase.ts` bricht im Entwicklungsmodus (`__DEV__`) mit klarer Fehlermeldung ab, wenn `EXPO_PUBLIC_SUPABASE_URL` nicht auf das Test-Projekt zeigt. Die Test-Projekt-Ref steht dafür als Konstante im Code (sie ist ohnehin öffentlich). Produktions-Builds sind nicht betroffen, weil `__DEV__` dort `false` ist.
- **Suchmaschinen:** in `vercel.json` ein `X-Robots-Tag: noindex` nur für den Host `test.lsc-itsolutions.net`.
- **Keep-Alive:** `.github/workflows/supabase-keepalive.yml` pingt beide Projekte (neue Secrets `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`). GitHub führt Zeitpläne nur von `main` aus, der Ping für Test greift also erst nach dem ersten Release.
- **Vorlage:** `.env.example` enthält künftig direkt die Test-URL, den öffentlichen Test-Anon-Key und `EXPO_PUBLIC_APP_ENV=test`. So arbeitet das ganze Team lokal automatisch gegen die Test-Datenbank.
- **Doku:** kurzer Abschnitt „Umgebungen und Release-Ablauf“ in `CLAUDE.md`.

### 2. Testdaten-Skript (Claude)
`scripts/seed-test.mjs`, Aufruf über `npm run seed:test`, nutzt das vorhandene `@supabase/supabase-js`.

- **Schutz vor Fehlbedienung:** Das Skript bricht ab, wenn die Tabelle `public.test_environment_marker` fehlt. Sie wird nur im Test-Projekt von Hand angelegt und steht bewusst in keiner Migration.
- **Zugangsdaten:** Service-Role-Key und Testpasswort nur lokal in `.env.test.local` (in `.gitignore` aufnehmen).
- **Ablauf:** erst alle Testdaten löschen, dann neu anlegen. Löschreihenfolge beachten: `invoices` vor `orders`, weil `invoice_items` Aufträge mit `on delete restrict` schützt.
- **Inhalt:** 1 Chef, 2 Fahrer, 1 Fremdfahrer, LKW und Auflieger, Firmen, Aufträge in jedem Status, Tankungen, Rechnungen. LKW zuerst anlegen, weil Tankungen sonst abgelehnt werden.

### 3. Test-Projekt aufsetzen (Simon, mit fertigen Anleitungen von Claude)
1. Neues Supabase-Gratis-Projekt anlegen. Vorher prüfen, ob ein Platz frei ist (maximal 2 aktive).
2. Alle Migrationen aus `supabase/migrations/` in Zeitstempel-Reihenfolge einspielen. Claude liefert sie als eine zusammengefasste Datei.
3. **Schema-Vergleich:** Claude liefert eine einzelne Prüf-Abfrage (Spalten, Constraints, Indizes, Policies, Funktionen, Trigger als JSON). Simon führt sie in beiden Projekten aus, Claude vergleicht die Ergebnisse. Das ist nötig, weil das Repo die echte Datenbank nachweislich nicht vollständig abbildet (u. a. fehlen `20260911140000` und `20260911170000`). Abweichungen werden per wiederholbarer Migration behoben.
4. Alle 17 Functions aus `supabase/dashboard-deploy/<name>.ts` einspielen, JWT-Einstellung wie im Echtprojekt.
5. Auth-Einstellungen wie im Echtprojekt setzen, Marker-Tabelle anlegen, `npm run seed:test` ausführen.

### 4. Vercel und Domain (Simon, Claude prüft danach)
1. Vorhandene Env-Variablen so aufteilen, dass die echten Werte **nur** für Production gelten.
2. Für **alle** Preview-Deployments die Test-Werte setzen. So kann kein Vorschau-Build die echte Datenbank erreichen.
3. `test.lsc-itsolutions.net` dem Branch `test` zuweisen und den DNS-Eintrag setzen.
4. Auch die Vercel-Umgebung „Development“ auf die Test-Werte setzen, damit `vercel env pull` nie echte Werte auf einen Rechner holt.
5. Lokale `.env` bei allen im Team durch die neue `.env.example` ersetzen, eine eventuell vorhandene `.env.local` prüfen und die App mit `npx expo start -c` neu starten, weil Expo die Werte beim Start einbackt.

**Arbeiten auf localhost:** Die App nutzt dort nur das Test-Projekt, inklusive Edge Functions und Dateiablage. Angemeldet wird mit den Testkonten, echte Konten existieren in der Test-Datenbank nicht.

### 5. Release-Ablauf ab jetzt
1. Änderung auf `test` entwickeln, Migrationen und Functions zuerst im Test-Projekt einspielen.
2. Auf `test.lsc-itsolutions.net` prüfen.
3. Freigabe: Migrationen im Echtprojekt, dann Functions, dann Merge von `test` nach `main`.

## Verifikation
- `npx tsc --noEmit`, `npm run lint`, `npx expo export -p web`.
- **Trennung:** Im Web-Build von `test` steht nur die Test-Projekt-URL, im Production-Build nur die echte.
- **Banner:** sichtbar auf localhost und der Test-Adresse, nicht auf `lsc-itsolutions.net`.
- **Localhost-Sperre:** Mit einer anderen Supabase-URL in der `.env` startet die App lokal nicht, mit der Test-URL schon.
- **Schutz:** `seed:test` bricht gegen ein Projekt ohne Marker-Tabelle ab, bevor etwas gelöscht wird.
- **Durchlauf auf Test:** Login mit allen drei Rollen, Auftrag anlegen und abschließen, Tankung, Rechnung, alle Excel-Exporte.
- **Echtbetrieb unverändert:** Belegnummer, Transportnummer und Fahrerliste vor und nach dem Testlauf vergleichen.

## Zu besprechen
1. **Gratis-Platz:** Ist im Supabase-Konto noch ein zweites aktives Gratis-Projekt frei? Das ist noch nicht geprüft.
2. **Zuständigkeit:** Wer spielt Migrationen und Functions ein? Künftig passiert das zweimal, zuerst im Test-Projekt und nach der Freigabe im Echtprojekt.
3. **Freigabe:** Wer entscheidet, dass eine Änderung von `test` in den Echtbetrieb darf?
4. **Testzugang:** Die Test-Adresse ist öffentlich erreichbar und nur durch den Login geschützt. Sie enthält ausschließlich erfundene Daten. Passt das für alle, und wie teilen wir die Testpasswörter?
5. **Aktueller Arbeitsstand:** Viele Änderungen sind noch nicht committet. Sollen sie alle auf den Branch `test`?
6. **Echte Datenbank:** Welche Daten liegen heute im bestehenden Projekt, und was muss vor dem Start weg?
7. **Backups und Lizenz:** Wie sichern wir echte Rechnungen im Gratis-Tarif, und wie gehen wir mit der Vercel-Lizenz um (siehe unten)?

## Nicht Teil dieses Plans (vor dem Start zu klären)
- **Bereinigung der echten Datenbank** von bisherigen Testdaten. Das geschieht nur nach eigener Prüfung und Freigabe.
- **Backups:** Supabase Free macht keine automatischen Backups, für echte Rechnungen ist eine eigene Lösung nötig.
- **Vercel-Lizenz:** Vercel Hobby erlaubt nur nicht-kommerzielle Nutzung.
