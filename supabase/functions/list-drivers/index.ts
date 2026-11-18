// Supabase Edge Function: list-drivers
//
// Lets an authenticated "boss" account list all "driver" accounts, so the
// UI can show existing drivers and let the boss edit them.
//
// Deploy: supabase functions deploy list-drivers

import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
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
    return internalError("list-drivers", listError);
  }

  // Wer Fahrer ist, steht in public.profiles — fremde Fahrer und der Chef
  // gehören nicht in diese Liste.
  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id, license_plate")
    .eq("role", "driver");

  if (profilesError) {
    return internalError("list-drivers", profilesError);
  }

  const platesByDriver = new Map(
    profiles.map((p) => [p.id as string, (p.license_plate as string | null) ?? ""])
  );

  const drivers = data.users
    .filter((u) => platesByDriver.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.email ? emailToUsername(u.email) : u.id,
      licensePlate: platesByDriver.get(u.id) ?? "",
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return json({ drivers });
});
