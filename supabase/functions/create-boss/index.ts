// Supabase Edge Function: create-boss
//
// Lets an authenticated "boss" account create a second "boss" account with
// a username + password (no email — see _shared/email.ts for why).
//
// Bewusst eine eigene Function und kein Rollen-Parameter an create-driver:
// Ein Chef-Konto sieht alles und darf alles. Wer das anlegt, soll das auch
// aufrufen müssen — ein vertippter Parameter an der Fahrer-Function soll
// niemals versehentlich einen zweiten Chef erzeugen können.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy create-boss

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

  let body: { username?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { username, password, name } = body;
  if (!username || !password) {
    return json({ error: "username and password are required" }, 400);
  }
  if (!isValidUsername(username)) {
    return json(
      { error: "Username must be 3-32 characters: letters, numbers, . _ -" },
      400
    );
  }
  // Strenger als bei Fahrern (6): Ein Chef-Konto kommt an alle Daten.
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }

  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: name?.trim() ? { name: name.trim() } : {},
  });

  if (createError || !data.user) {
    // Supabase meldet eine doppelte Adresse als "already registered" — aus
    // Sicht des Chefs ist das ein vergebener Benutzername.
    const message = createError?.message.toLowerCase().includes("already")
      ? "That username is already taken"
      : createError?.message ?? "Could not create user";
    return json({ error: message }, 400);
  }

  // Ohne Profilzeile kommt das Konto nirgends hinein. Scheitert sie, das
  // Konto wieder entfernen, statt einen halb angelegten Chef zu hinterlassen.
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: data.user.id, role: "boss" });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id);
    return json({ error: profileError.message }, 500);
  }

  return json({ success: true, userId: data.user.id });
});
