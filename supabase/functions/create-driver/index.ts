// Supabase Edge Function: create-driver
//
// Lets an authenticated "boss" account create a new "driver" account with
// just a username + password (no email — see _shared/email.ts for why).
//
// Deploy with the Supabase CLI:
//   supabase functions deploy create-driver
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the Supabase platform — no manual secret
// needs to be set for this function to work.

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

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { username, password } = body;
  if (!username || !password) {
    return json({ error: "username and password are required" }, 400);
  }
  if (!isValidUsername(username)) {
    return json(
      { error: "Username must be 3-32 characters: letters, numbers, . _ -" },
      400
    );
  }
  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { role: "driver" },
  });

  if (createError) {
    // Supabase reports a duplicate email as "already registered" — but
    // from the boss's point of view, that's a taken username.
    const message = createError.message.toLowerCase().includes("already")
      ? "That username is already taken"
      : createError.message;
    return json({ error: message }, 400);
  }

  return json({ success: true, userId: data.user?.id });
});
