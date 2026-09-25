// Supabase Edge Function: delete-external-driver
//
// Lets an authenticated "boss" account permanently delete a subcontractor
// driver's account ("fremder Fahrer"). Confirmation happens client-side
// before this is ever called.
//
// Die hochgeladenen CMR-Belege bleiben erhalten: Sie gehören zum Auftrag
// (Ordner im Bucket und external_orders.cmr), nicht zum Konto. Supabase
// weigert sich aber, ein Konto zu löschen, dem noch Dateien im Storage
// gehören — deshalb wird vorher nur der Besitz freigegeben.
//
// profiles und external_driver_accounts verschwinden per Cascade mit, die
// Zuweisung an den Fremdaufträgen wird auf null gesetzt.
//
// Deploy: supabase functions deploy delete-external-driver

import { corsHeaders, json } from "../_shared/cors.ts";
import { getRole, verifyBoss } from "../_shared/verify-boss.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient) {
    return json({ error }, status ?? 401);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { userId } = body;
  if (!userId) {
    return json({ error: "userId is required" }, 400);
  }

  // Nur Zugänge fremder Fahrer — nie ein eigener Fahrer oder der Chef,
  // auch nicht über eine manipulierte Anfrage.
  let role: string | null;
  try {
    role = await getRole(adminClient, userId);
  } catch (roleError) {
    return json({ error: (roleError as Error).message }, 500);
  }
  if (role !== "external_driver") {
    return json({ error: "That account is not an external driver" }, 403);
  }

  const { error: releaseError } = await adminClient.rpc("release_storage_ownership", {
    uid: userId,
  });
  if (releaseError) {
    return json({ error: releaseError.message }, 500);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  return json({ success: true });
});
