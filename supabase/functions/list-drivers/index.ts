// Supabase Edge Function: list-drivers
//
// Lets an authenticated "boss" account list all "driver" accounts, so the
// UI can show existing drivers and let the boss edit them.
//
// Deploy: supabase functions deploy list-drivers

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

  const { adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient) {
    return json({ error }, status ?? 401);
  }

  // Fine for this project's scale — paginate if the fleet ever exceeds
  // a single page (Supabase defaults to 50 users per page).
  const { data, error: listError } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  if (listError) {
    return json({ error: listError.message }, 400);
  }

  // Wer Fahrer ist, steht in public.profiles — fremde Fahrer und der Chef
  // gehören nicht in diese Liste.
  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "driver");

  if (profilesError) {
    return json({ error: profilesError.message }, 400);
  }

  const driverIds = new Set(profiles.map((p) => p.id as string));

  const drivers = data.users
    .filter((u) => driverIds.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.email ? emailToUsername(u.email) : u.id,
      licensePlate: (u.user_metadata?.license_plate as string | undefined) ?? "",
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return json({ drivers });
});
