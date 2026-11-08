// Supabase Edge Function: update-external-driver
//
// Lets an authenticated "boss" account change the username of a
// subcontractor driver's account ("fremder Fahrer"). Das Passwort bleibt;
// der fremde Fahrer meldet sich ab jetzt mit dem neuen Namen an.
//
// Der Benutzername steht an zwei Stellen: als synthetische E-Mail im
// Auth-Konto (zum Anmelden) und in public.external_driver_accounts (zum
// Anzeigen). Beide werden hier gemeinsam geändert — die App darf die
// Spalte username selbst nicht schreiben (siehe
// supabase/migrations/20260915130000_external_driver_access.sql).
//
// Deploy: supabase functions deploy update-external-driver

import { corsHeaders, json } from "../_shared/cors.ts";
import { isValidUsername, usernameToEmail } from "../_shared/email.ts";
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

  let body: { userId?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    return json({ error: "userId is required" }, 400);
  }
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!isValidUsername(username)) {
    return json(
      { error: "Benutzername: 3–32 Zeichen, nur Buchstaben, Ziffern, . _ -" },
      400
    );
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

  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Zugang nicht gefunden" }, 404);
  }
  const previousEmail = existing.user.email;

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: usernameToEmail(username),
  });
  if (authError) {
    const taken = authError.message.toLowerCase().includes("already");
    return json(
      {
        error: taken
          ? `Der Benutzername „${username}“ ist schon vergeben`
          : authError.message,
      },
      taken ? 409 : 400
    );
  }

  const { error: accountError } = await adminClient
    .from("external_driver_accounts")
    .update({ username })
    .eq("user_id", userId);

  if (accountError) {
    // Anmeldename zurücksetzen, sonst zeigte die App einen anderen Namen an
    // als den, mit dem die Anmeldung tatsächlich klappt.
    if (previousEmail) {
      await adminClient.auth.admin.updateUserById(userId, { email: previousEmail });
    }
    const taken = accountError.code === "23505";
    return json(
      {
        error: taken
          ? `Der Benutzername „${username}“ ist schon vergeben`
          : accountError.message,
      },
      taken ? 409 : 500
    );
  }

  return json({ success: true, username });
});
