import { deleteDraft, saveDraft } from '@/lib/orderDrafts';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Merkt sich ein halb ausgefülltes Formular als Entwurf auf diesem Gerät,
 * damit beim Zurückgehen nichts verloren geht — etwa ein neuer oder
 * duplizierter Auftrag, bei dem der Chef vor "PDF erstellen" auf "Zurück"
 * drückt. Alle Entwürfe stehen unter "Entwürfe" (app/chef/drafts.tsx).
 *
 * Ablauf:
 *   * Jede Änderung wird kurz danach unter `key` gespeichert (und beim
 *     Verlassen des Bildschirms sofort).
 *   * Ist das Formular wieder so wie beim Öffnen, wird bei einem neuen
 *     Formular nichts gemerkt (keepUnchanged = false). Ein geöffneter
 *     Entwurf bleibt dagegen stehen, auch ohne Änderung (keepUnchanged = true).
 *   * Nach dem erfolgreichen Speichern ruft das Formular `clear()` auf.
 *
 * Geladen wird ein Entwurf nicht hier, sondern vom Bildschirm, bevor er das
 * Formular zeigt (lib/orderDrafts.ts → loadDraft): Er kommt als
 * Anfangswerte ins Formular.
 *
 * key = undefined schaltet alles ab (etwa beim Bearbeiten eines bestehenden
 * Auftrags — dort steht ja schon alles in der Datenbank).
 *
 * meta wird mit dem Entwurf gespeichert, z. B. { copyFrom, copyNr } bei einer
 * Kopie — die Entwurfsliste zeigt damit "Kopie von Nr. 123".
 */
export function useFormDraft<T>(
  key: string | undefined,
  value: T,
  options: { meta?: Record<string, string>; keepUnchanged?: boolean } = {}
): {
  /** Entwurf löschen — nach erfolgreichem Speichern. */
  clear: () => Promise<void>;
} {
  const clearedRef = useRef(false);
  const initialJsonRef = useRef(JSON.stringify(value));
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const write = useCallback(
    async (json: string) => {
      if (!key || clearedRef.current) return;
      if (json === initialJsonRef.current && !optionsRef.current.keepUnchanged) {
        await deleteDraft(key);
        return;
      }
      await saveDraft(key, JSON.parse(json), optionsRef.current.meta);
    },
    [key]
  );

  // Speichern, kurz nach jeder Änderung. Der allererste Wert ist der beim
  // Öffnen — den gibt es schon (oder er ist leer), also nichts zu tun.
  const json = JSON.stringify(value);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!key || clearedRef.current) return;
    if (!dirtyRef.current && json === initialJsonRef.current) return;
    dirtyRef.current = true;
    pendingRef.current = json;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending !== null) write(pending);
    }, 400);
  }, [json, key, write]);

  // Beim Verlassen: was noch aussteht, sofort speichern.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending !== null) write(pending);
    },
    [write]
  );

  const clear = useCallback(async () => {
    clearedRef.current = true;
    pendingRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (key) await deleteDraft(key);
  }, [key]);

  return { clear };
}
