import { supabase } from '@/lib/supabase';

/**
 * Offene Aufträge zwischen "eigen" und "fremd" umziehen, wenn sich die
 * Disposition ändert. Id und Transportnummer bleiben gleich, die Regeln
 * stehen in supabase/migrations/20261118110000_convert_orders.sql.
 */
export async function convertExternalToOwnOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('convert_external_to_own_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function convertOwnToExternalOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('convert_own_to_external_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}
