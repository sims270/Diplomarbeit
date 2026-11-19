// Supabase Edge Function: reset-external-driver-password
//
// Lets an authenticated "boss" account give a subcontractor driver's
// account ("fremder Fahrer") a new random password. Das Passwort wird in
// external_driver_accounts.password gespeichert, damit der Chef es beim
// Teilen eines Auftrags wieder mitschicken kann; es verschwindet mit dem
// Zugang (20261119180000_store_external_driver_password.sql). Das alte
// Passwort gilt ab sofort nicht mehr.
//
// Deploy: supabase functions deploy reset-external-driver-password

import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
import { randomPassword } from "../_shared/password.ts";
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
  if (!userId || typeof userId !== "string") {
    return json({ error: "userId is required" }, 400);
  }

  // Nur Zugänge fremder Fahrer — nie ein eigener Fahrer oder der Chef,
  // auch nicht über eine manipulierte Anfrage.
  let role: string | null;
  try {
    role = await getRole(adminClient, userId);
  } catch (roleError) {
    return internalError("reset-external-driver-password", roleError);
  }
  if (role !== "external_driver") {
    return json({ error: "That account is not an external driver" }, 403);
  }

  const password = randomPassword();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    return internalError("reset-external-driver-password", updateError);
  }

  // Erst nach dem erfolgreichen Setzen speichern, sonst stünde ein
  // Passwort in der Tabelle, mit dem die Anmeldung scheitert.
  const { error: storeError } = await adminClient
    .from("external_driver_accounts")
    .update({ password })
    .eq("user_id", userId);
  if (storeError) {
    return internalError("reset-external-driver-password", storeError);
  }

  return json({ success: true, password });
});
