// Supabase Edge Function: update-driver
//
// Lets an authenticated "boss" account change a driver's username and/or
// password. Both fields are optional — send only what should change.
//
// Deploy: supabase functions deploy update-driver

import { corsHeaders, json } from "../_shared/cors.ts";
import { isValidUsername, usernameToEmail } from "../_shared/email.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

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

  let body: { userId?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { userId, username, password } = body;
  if (!userId) {
    return json({ error: "userId is required" }, 400);
  }
  if (!username && !password) {
    return json({ error: "Provide a new username and/or password" }, 400);
  }

  // Only edit driver accounts through this endpoint — never lets a boss
  // accidentally (or maliciously, via a tampered request) touch another
  // boss account.
  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Driver not found" }, 404);
  }
  if (existing.user.user_metadata?.role !== "driver") {
    return json({ error: "That account is not a driver" }, 403);
  }

  const updates: { email?: string; password?: string } = {};

  if (username) {
    if (!isValidUsername(username)) {
      return json(
        { error: "Username must be 3-32 characters: letters, numbers, . _ -" },
        400
      );
    }
    updates.email = usernameToEmail(username);
  }

  if (password) {
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }
    updates.password = password;
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    userId,
    updates
  );

  if (updateError) {
    const message = updateError.message.toLowerCase().includes("already")
      ? "That username is already taken"
      : updateError.message;
    return json({ error: message }, 400);
  }

  return json({ success: true });
});
