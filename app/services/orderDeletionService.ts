import { supabase } from '@/lib/supabase';

/**
 * Löscht einen Auftrag samt Belegen über die Edge Function delete-order. Der
 * Chef hat im Bucket selbst keine Löschrechte.
 *
 * Wirft bei einem verrechneten Auftrag den Fehler 'ORDER_INVOICED', den
 * components/DeleteOrderModal.tsx in einen verständlichen Text übersetzt.
 */
export async function deleteOrderWithDocuments(orderId: string, external: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-order', {
    body: { orderId, external },
  });

  if (!error && !data?.error) return;

  // Bei 4xx/5xx steht die Begründung im JSON-Body der Antwort.
  let message: string | undefined = data?.error;
  const response = (error as { context?: unknown } | null)?.context;
  if (!message && response instanceof Response) {
    try {
      message = (await response.clone().json())?.error;
    } catch {
      // Kein JSON-Body: Dann bleibt es bei der Meldung von supabase-js.
    }
  }

  throw new Error(message ?? error?.message ?? '');
}
