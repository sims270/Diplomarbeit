// Supabase Edge Function: reset-external-driver-password
//
// Lets an authenticated "boss" account give a subcontractor driver's
// account ("fremder Fahrer") a new random password. Das Passwort wird
// nirgends gespeichert und nur in dieser Antwort zurückgegeben — hat der
// fremde Fahrer es vergessen, gibt es kein Nachschauen, nur ein neues. Das
// alte Passwort gilt ab sofort nicht mehr.
//
// Deploy: supabase functions deploy reset-external-driver-password

import { corsHeaders, json } from "../_shared/cors.ts";
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
    return json({ error: (roleError as Error).message }, 500);
  }
  if (role !== "external_driver") {
    return json({ error: "That account is not an external driver" }, 403);
  }

  const password = randomPassword();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    return json({ error: updateError.message }, 400);
  }

  return json({ success: true, password });
});
