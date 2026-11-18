import { parseAmount } from '@/app/services/invoiceService';
import { formatAmount } from '@/lib/invoiceTotals';
import { supabase } from '@/lib/supabase';

/**
 * Vereinbarter Preis eines eigenen Auftrags — nur für den Chef.
 *
 * Absichtlich nicht Teil von `Order`: Der Auftrag geht auch an die
 * Fahreransicht und aufs PDF, der Preis darf dort nicht landen.
 * Tabelle: supabase/migrations/20261118100000_create_order_prices.sql
 */
export async function getOrderPrice(orderId: string): Promise<string> {
  const { data, error } = await supabase
    .from('order_prices')
    .select('preis')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? formatAmount(Number(data.preis)) : '';
}

/** Ein leeres Feld entfernt den Preis wieder. */
export async function saveOrderPrice(orderId: string, price: string): Promise<void> {
  const preis = parseAmount(price);

  const { error } =
    preis === null
      ? await supabase.from('order_prices').delete().eq('order_id', orderId)
      : await supabase
          .from('order_prices')
          .upsert({ order_id: orderId, preis, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}
