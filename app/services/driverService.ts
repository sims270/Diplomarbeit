import { supabase } from '@/lib/supabase';

/**
 * Real drivers a boss created via Fahrerverwaltung (Supabase Auth accounts
 * with role "driver", listed through the list-drivers edge function) — as
 * opposed to the old orderService demo data, which never reflected what a
 * boss actually sees (it always showed the fixed example.json roster
 * regardless of which drivers were really created).
 */
export interface Driver {
  id: string;
  username: string;
  createdAt: string;
}

export async function getDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.functions.invoke('list-drivers', {
    method: 'GET',
  });

  // supabase-js only rejects `error` for transport/network failures; our
  // function returns 4xx/5xx bodies with an `error` field on failure, so
  // both cases need checking here.
  if (error || data?.error) {
    throw new Error(data?.error ?? error?.message ?? 'Unknown error');
  }

  return data.drivers ?? [];
}
