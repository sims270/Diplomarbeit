# Plan: Testumgebung neben dem Echtbetrieb (TRANSLOG PRO)

**Status:** Vorschlag zur Besprechung im Team, Stand 20.11.2026. Umgesetzt ist noch nichts. Angelegt ist bisher nur ein leeres Supabase-Projekt für Tests.

**Kurz gesagt:** Das Unternehmen arbeitet auf `lsc-itsolutions.net` mit der echten Datenbank. Wir testen auf den automatischen Vorschau-Adressen von Vercel und auf localhost, jeweils mit einer zweiten, kostenlosen Datenbank voller erfundener Daten. Die beiden Welten berühren sich nicht, und das Unternehmen sieht von den Tests nichts.

Die offenen Fragen für unsere Besprechung stehen am Ende unter „Zu besprechen“.

## Context
Das Unternehmen soll die Software produktiv nutzen, während das Projektteam weiter Änderungen testet. Testdaten dürfen im Echtbetrieb weder sichtbar sein noch etwas verändern.

Eine Trennung innerhalb der echten Datenbank scheidet aus. Testdaten würden Belegnummern und Transportnummern verbrauchen, km-Stände anheben und in Firmenlisten, Fahrerlisten und Excel-Exporten auftauchen. Die Exporte umgehen RLS per Service-Role.

**Achtung, heutiger Stand (geprüft am 20.11.2026):** `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` gelten bei Vercel gemeinsam für Production und Preview. **Jede Vorschau-Adresse arbeitet also heute mit der echten Datenbank.** Schritt 1 behebt das und hat deshalb Vorrang.

**Entscheidungen:**
- zwei getrennte Supabase-Projekte, alles in Gratis-Tarifen
- Nutzung nur im Browser
- Vercel-Vorschau-Adressen statt eigener Test-Domain
- Vorschauen ohne Vercel-Login, damit das ganze Team testen kann
- jeder Branch außer `main` bekommt eine Vorschau mit der Test-Datenbank

## Zielbild

| | Echtbetrieb | Test |
|---|---|---|
| Adresse | `lsc-itsolutions.net` | `diplomarbeit-git-<branch>-sims270s-projects.vercel.app` |
| Git-Branch | `main` | jeder andere Branch, gesammelt auf `test` |
| Vercel-Umgebung | Production | Preview |
| Supabase | bestehendes Projekt | neues Gratis-Projekt (angelegt, noch leer) |
| `EXPO_PUBLIC_APP_ENV` | nicht gesetzt | `test` |
| Daten | echt | erfunden, jederzeit neu erzeugbar |

Jede Vorschau hat zwei Adressen: eine pro Version, die sich bei jedem Push ändert, und eine feste pro Branch. Zum Testen teilen wir die feste, zum Beispiel `diplomarbeit-git-test-sims270s-projects.vercel.app`.

## Schritte

### 1. Vercel-Variablen trennen (Simon, zuerst und dringend)
Im Vercel-Dashboard unter Project → Settings → Environment Variables:
1. Bei `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` das Häkchen bei **Preview** entfernen. Die echten Werte gelten dann **nur** für Production.
2. Beide Variablen neu anlegen, mit den Werten des Test-Projekts und nur für **Preview** (alle Branches) und **Development**.
3. `EXPO_PUBLIC_APP_ENV=test` anlegen, ebenfalls für Preview und Development.

Production ändert sich dabei nicht und braucht keinen neuen Build.

### 2. Alte Vorschauen entfernen, dann Vercel-Schutz abschalten (Simon)
Ältere Vorschau-Builds enthalten die echten Werte fest eingebaut, weil Expo die Variablen beim Build einbackt. Sie bleiben erreichbar, auch nachdem die Variablen geändert sind.
1. Unter Deployments alle bisherigen **Preview**-Deployments löschen. Production-Deployments bleiben.
2. Erst danach unter Settings → Deployment Protection die **Vercel Authentication** abschalten.

Danach sind Vorschau-Adressen ohne Vercel-Konto erreichbar. Sie enthalten nur Testdaten und verlangen den App-Login mit Testkonten. Vercel kennzeichnet `*.vercel.app`-Vorschauen selbst für Suchmaschinen als nicht zu indexieren, eine Änderung an `vercel.json` braucht es dafür nicht.

### 3. Test-Projekt aufsetzen (Simon, mit fertigen Anleitungen von Claude)
1. Alle Migrationen aus `supabase/migrations/` in Zeitstempel-Reihenfolge im SQL Editor einspielen. Claude liefert sie als eine zusammengefasste Datei.
2. **Schema-Vergleich:** Claude liefert eine einzelne Prüf-Abfrage (Spalten, Constraints, Indizes, Policies, Funktionen, Trigger als JSON). Simon führt sie in beiden Projekten aus, Claude vergleicht die Ergebnisse. Das ist nötig, weil das Repo die echte Datenbank nachweislich nicht vollständig abbildet, unter anderem fehlen `20260911140000` und `20260911170000`. Abweichungen behebt eine wiederholbare Migration, die anschließend in beiden Projekten gleich ist.
3. Alle 17 Functions aus `supabase/dashboard-deploy/<name>.ts` einspielen, mit derselben JWT-Einstellung wie im Echtprojekt.
4. Auth-Einstellungen wie im Echtprojekt setzen, insbesondere die Selbstregistrierung.
5. Die Marker-Tabelle `public.test_environment_marker` von Hand anlegen. Sie steht bewusst in keiner Migration und kennzeichnet das Projekt als Testprojekt.
6. Ersten Test-Chef anlegen, danach `npm run seed:test` ausführen (siehe Schritt 5).

### 4. Code auf Branch `test` (Claude)
Der aktuelle, nicht committete Arbeitsstand kommt auf den neuen Branch `test`, **nicht** auf `main`. Ein Push auf `main` würde sofort den Echtbetrieb deployen, bevor die Migrationen dort eingespielt sind.

- **Banner:** neue Komponente `components/TestEnvironmentBanner.tsx`, eingebunden in `RootContent` in `app/_layout.tsx`. Sie erscheint nur bei `EXPO_PUBLIC_APP_ENV === "test"`. Texte in `constants/translations.ts` (de und en), Farben aus `Colors[scheme]`.
- **Localhost-Sperre:** `lib/supabase.ts` bricht im Entwicklungsmodus (`__DEV__`) mit klarer Fehlermeldung ab, wenn `EXPO_PUBLIC_SUPABASE_URL` nicht auf das Test-Projekt zeigt. Die Test-Projekt-Ref steht dafür als Konstante im Code, sie ist ohnehin öffentlich. Produktions-Builds sind nicht betroffen, weil `__DEV__` dort `false` ist.
- **Keep-Alive:** `.github/workflows/supabase-keepalive.yml` pingt beide Projekte, mit den neuen Secrets `TEST_SUPABASE_URL` und `TEST_SUPABASE_ANON_KEY`. GitHub führt Zeitpläne nur von `main` aus. Bis zum ersten Release hält Testen das Projekt aktiv, oder der Workflow wird von Hand gestartet.
- **Vorlage:** `.env.example` enthält künftig direkt die Test-URL, den öffentlichen Test-Anon-Key und `EXPO_PUBLIC_APP_ENV=test`. So arbeitet das ganze Team lokal automatisch gegen die Test-Datenbank.
- **Doku:** kurzer Abschnitt „Umgebungen und Release-Ablauf“ in `CLAUDE.md`.

### 5. Testdaten-Skript (Claude)
`scripts/seed-test.mjs`, Aufruf über `npm run seed:test`. Es nutzt das vorhandene `@supabase/supabase-js`.

- **Schutz vor Fehlbedienung:** Das Skript bricht ab, wenn die Marker-Tabelle fehlt. Gegen die echte Datenbank kann es also nichts löschen.
- **Zugangsdaten:** Service-Role-Key und Testpasswort liegen nur lokal in `.env.test.local`, die Datei kommt in `.gitignore`.
- **Ablauf:** Erst alle Testdaten löschen, dann neu anlegen. `invoices` müssen vor `orders` gelöscht werden, weil `invoice_items` Aufträge mit `on delete restrict` schützt.
- **Inhalt:** 1 Chef, 2 Fahrer, 1 Fremdfahrer, LKW und Auflieger, Firmen, Aufträge in jedem Status, Tankungen, Rechnungen. Die LKW kommen zuerst, weil Tankungen sonst abgelehnt werden.

### 6. Localhost bei allen im Team umstellen
- Lokale `.env` durch die neue `.env.example` ersetzen und eine eventuell vorhandene `.env.local` prüfen.
- Die App mit `npx expo start -c` neu starten, weil Expo die Werte beim Start einbackt.
- Danach nutzt die App lokal nur das Test-Projekt, inklusive Edge Functions und Dateiablage. Angemeldet wird mit den Testkonten, echte Konten existieren in der Test-Datenbank nicht.

### 7. Release-Ablauf ab jetzt
1. Jede Änderung auf einem eigenen Branch entwickeln. Migrationen und Functions zuerst im Test-Projekt einspielen.
2. Auf der Vorschau-Adresse des Branches prüfen, danach in `test` zusammenführen und dort gemeinsam prüfen.
3. Freigabe: Migrationen im Echtprojekt, dann Functions, dann Merge von `test` nach `main`.

## Verifikation
- `npx tsc --noEmit`, `npm run lint`, `npx expo export -p web`.
- **Trennung:** Im Vorschau-Build steht nur die Test-Projekt-URL, im Production-Build nur die echte. Prüfen lässt sich das im Browser unter Netzwerk, an der Adresse der Supabase-Anfragen.
- **Zugang:** Die feste Vorschau-Adresse von `test` lässt sich in einem privaten Fenster ohne Vercel-Login öffnen.
- **Keine alten Vorschauen:** In der Deployment-Liste gibt es keine Preview-Deployments aus der Zeit vor Schritt 1.
- **Banner:** sichtbar auf localhost und den Vorschau-Adressen, nicht auf `lsc-itsolutions.net`.
- **Localhost-Sperre:** Mit einer anderen Supabase-URL in der `.env` startet die App lokal nicht, mit der Test-URL schon.
- **Schutz:** `seed:test` bricht gegen ein Projekt ohne Marker-Tabelle ab, bevor etwas gelöscht wird.
- **Durchlauf auf Test:** Login mit allen drei Rollen, Auftrag anlegen und abschließen, Tankung, Rechnung, alle Excel-Exporte.
- **Echtbetrieb unverändert:** Belegnummer, Transportnummer und Fahrerliste vor und nach dem Testlauf vergleichen.

## Zu besprechen
1. **Zuständigkeit:** Wer spielt Migrationen und Functions ein? Künftig passiert das zweimal, zuerst im Test-Projekt und nach der Freigabe im Echtprojekt.
2. **Freigabe:** Wer entscheidet, dass eine Änderung von `test` in den Echtbetrieb darf?
3. **Testpasswörter:** Wie teilen wir die Zugangsdaten der Testkonten im Team?
4. **Aktueller Arbeitsstand:** Viele Änderungen sind noch nicht committet. Sollen sie alle auf den Branch `test`?
5. **Echte Datenbank:** Welche Daten liegen heute im bestehenden Projekt, und was muss vor dem Start weg?
6. **Backups und Lizenz:** Wie sichern wir echte Rechnungen im Gratis-Tarif, und wie gehen wir mit der Vercel-Lizenz um (siehe unten)?

## Nicht Teil dieses Plans (vor dem Start zu klären)
- **Bereinigung der echten Datenbank** von bisherigen Testdaten. Das geschieht nur nach eigener Prüfung und Freigabe.
- **Backups:** Supabase Free macht keine automatischen Backups, für echte Rechnungen ist eine eigene Lösung nötig.
- **Vercel-Lizenz:** Vercel Hobby erlaubt nur nicht-kommerzielle Nutzung.
