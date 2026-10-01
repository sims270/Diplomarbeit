import { supabase } from '@/lib/supabase';
import { usernameToEmail } from '@/lib/username';

/**
 * Änderungen am eigenen Konto. Anders als die Fahrerverwaltung läuft das
 * ohne Edge Function: Supabase erlaubt jedem angemeldeten Konto, seinen
 * eigenen Namen und sein Passwort zu ändern — fremde Konten bleiben damit
 * unerreichbar, ganz ohne zusätzliche Rechteprüfung.
 */

/** Anzeigename (user_metadata.name), erscheint im Header und im Profil. */
export async function updateOwnName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Der Name darf nicht leer sein.');

  const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
  if (error) throw new Error(error.message);
}

/**
 * Passwort ändern. Das aktuelle Passwort wird zuerst geprüft, indem wir uns
 * damit erneut anmelden: Supabase verlangt es für `updateUser` nicht, sonst
 * könnte aber jeder an einem unbeaufsichtigten, angemeldeten Gerät den
 * Zugang übernehmen.
 */
export async function changeOwnPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: currentPassword,
  });
  if (signInError) {
    throw new Error('WRONG_CURRENT_PASSWORD');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
