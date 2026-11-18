// Supabase Edge Function: delete-driver
//
// Lets an authenticated "boss" account permanently delete a "driver"
// account. Confirmation happens client-side before this is ever called.
//
// Deploy: supabase functions deploy delete-driver

import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
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

  // Only ever delete driver accounts through this endpoint — never lets a
  // boss accidentally (or via a tampered request) delete a boss account.
  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Driver not found" }, 404);
  }
  if ((await getRole(adminClient, userId)) !== "driver") {
    return json({ error: "That account is not a driver" }, 403);
  }

  // Supabase löscht kein Konto, dem noch Dateien im Storage gehören. Die
  // hochgeladenen Belege gehören aber zum Auftrag und bleiben erhalten.
  const { error: releaseError } = await adminClient.rpc("release_storage_ownership", {
    uid: userId,
  });
  if (releaseError) {
    return internalError("delete-driver", releaseError);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return internalError("delete-driver", deleteError);
  }

  // Erst nach dem Löschen: Scheitert es, bleiben die Zuweisungen unberührt.
  // Die Datenbank hat assigned_to geleert (20261118120000), offene Aufträge
  // müssen wieder als "noch zuzuweisen" gelten.
  const { error: reopenError } = await adminClient
    .from("orders")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .is("assigned_to", null)
    .in("status", ["assigned", "in_progress"]);
  if (reopenError) {
    return internalError("delete-driver", reopenError);
  }

  return json({ success: true });
});
