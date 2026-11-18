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
import { internalError } from "../_shared/errors.ts";
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

  let body: { username?: string; password?: string; licensePlate?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { username, password, licensePlate } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return json({ error: "username and password are required" }, 400);
  }
  if (licensePlate !== undefined && licensePlate !== null && typeof licensePlate !== "string") {
    return json({ error: "License plate must be text" }, 400);
  }
  if (!isValidUsername(username)) {
    return json(
      { error: "Username must be 3-32 characters: letters, numbers, . _ -" },
      400
    );
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }

  // Das Kennzeichen ist optional: Der Chef legt einen Fahrer oft an, bevor
  // feststeht, welchen LKW er fährt. Kennzeichen sind in Österreich immer
  // in Großbuchstaben — einheitlich gespeichert, damit später ein
  // Vergleich mit dem Tanklisten-Eintrag nicht an der Schreibweise
  // scheitert.
  const plate = licensePlate?.trim().toUpperCase() ?? "";
  if (plate.length > 15) {
    return json({ error: "License plate must be at most 15 characters" }, 400);
  }

  // Rolle und Kennzeichen stehen in public.profiles, nicht im user_metadata —
  // das könnte der Fahrer selbst ändern.
  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });

  if (createError || !data.user) {
    // Supabase reports a duplicate email as "already registered" — but
    // from the boss's point of view, that's a taken username.
    const message = createError?.message.toLowerCase().includes("already")
      ? "That username is already taken"
      : "Could not create user";
    console.error("[create-driver]", createError);
    return json({ error: message }, 400);
  }

  // Ohne Profilzeile kommt das Konto nirgends hinein. Scheitert sie, das
  // Konto wieder entfernen, statt einen halb angelegten Fahrer zu hinterlassen.
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: data.user.id, role: "driver", license_plate: plate || null });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id);
    return internalError("create-driver", profileError);
  }

  return json({ success: true, userId: data.user.id });
});
