-- Passwörter der fremden Fahrer nicht mehr speichern.
--
-- Bisher stand das Passwort jedes Fremdfahrer-Zugangs im Klartext in
-- external_driver_accounts.password, damit der Chef es jederzeit erneut
-- anzeigen konnte (20260915130000_external_driver_access.sql). Jetzt sieht
-- er es nur noch einmal, direkt nach dem Anlegen. Hat der fremde Fahrer es
-- vergessen, erstellt der Chef ein neues (Edge Function
-- reset-external-driver-password) — wie bei den eigenen Fahrern wird damit
-- kein Passwort mehr irgendwo gespeichert.
--
-- Bestehende Zugänge bleiben gültig, ihre Passwörter funktionieren weiter;
-- sie lassen sich nur nicht mehr nachschauen.
--
-- Zusammen mit der neuen Fassung von create-external-driver einspielen: Die
-- alte Fassung schreibt noch in diese Spalte und scheitert ohne sie.
-- Wie alle Migrationen dieses Projekts beliebig oft ausführbar.

alter table public.external_driver_accounts
  drop column if exists password;

notify pgrst, 'reload schema';
