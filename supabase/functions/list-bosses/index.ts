// Supabase Edge Function: list-bosses
//
// Lists all "boss" accounts. Nur für einen angemeldeten Chef — Fahrer
// haben hier nichts verloren.
//
// Deploy: supabase functions deploy list-bosses

import { corsHeaders, json } from "../_shared/cors.ts";
import { emailToUsername } from "../_shared/email.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { caller, adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient || !caller) {
    return json({ error }, status ?? 401);
  }

  // Wie list-drivers: eine Seite reicht für dieses Projekt.
  const { data, error: listError } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    return json({ error: listError.message }, 400);
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "boss");

  if (profilesError) {
    return json({ error: profilesError.message }, 400);
  }

  const bossIds = new Set(profiles.map((p) => p.id as string));

  const bosses = data.users
    .filter((u) => bossIds.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.email ? emailToUsername(u.email) : u.id,
      name: (u.user_metadata?.name as string | undefined) ?? "",
      createdAt: u.created_at,
      // Damit die App das eigene Konto kennzeichnen und vor dem Löschen
      // schützen kann, ohne die Benutzer-ID selbst vergleichen zu müssen.
      isSelf: u.id === caller.id,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return json({ bosses });
});
