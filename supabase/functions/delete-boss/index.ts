// Supabase Edge Function: delete-boss
//
// Lets an authenticated "boss" account delete another "boss" account.
//
// Zwei Sperren, die beide serverseitig sitzen — die App prüft dasselbe noch
// einmal, aber verlassen darf man sich darauf nicht:
//
//   1. Niemand löscht sein eigenes Konto. Sonst wäre man mitten im Betrieb
//      ausgesperrt, mit laufender Sitzung und ohne Zugang.
//   2. Der letzte Chef bleibt. Ohne Chef kommt niemand mehr an die
//      Fahrer- und LKW-Verwaltung — das ließe sich nur noch im
//      Supabase-Dashboard reparieren.
//
// Deploy: supabase functions deploy delete-boss

import { corsHeaders, json } from "../_shared/cors.ts";
import { getRole, verifyBoss } from "../_shared/verify-boss.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { caller, adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient || !caller) {
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

  if (userId === caller.id) {
    return json({ error: "CANNOT_DELETE_SELF" }, 400);
  }

  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Account not found" }, 404);
  }

  // Nur Chef-Konten: Fahrer werden über delete-driver entfernt, damit die
  // dortigen Regeln gelten.
  if ((await getRole(adminClient, userId)) !== "boss") {
    return json({ error: "That account is not a boss" }, 403);
  }

  const { count, error: countError } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "boss");

  if (countError) {
    return json({ error: countError.message }, 400);
  }
  if ((count ?? 0) <= 1) {
    return json({ error: "CANNOT_DELETE_LAST_BOSS" }, 400);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  return json({ success: true });
});
