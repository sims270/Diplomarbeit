// Supabase Edge Function: create-external-driver
//
// Lets an authenticated "boss" account create a time-limited account for a
// subcontractor's driver ("fremder Fahrer"). Der Chef gibt Firmennamen,
// Benutzername und Ablaufdatum an; das Passwort entsteht hier. Fehlt der
// Benutzername, wird er wie früher aus dem Firmennamen gebildet. Welche
// Fremdaufträge der Zugang sieht, weist die App danach getrennt zu
// (external_orders.assigned_external_user_id).
//
// Das Passwort wird nirgends gespeichert: Der Chef sieht es genau einmal,
// in der Antwort dieser Function. Hat der fremde Fahrer es vergessen, lässt
// der Chef ein neues erstellen (reset-external-driver-password).
//
// Deploy: supabase functions deploy create-external-driver

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isValidUsername, usernameToEmail } from "../_shared/email.ts";
import { randomPassword } from "../_shared/password.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

function randomSuffix(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// "Honisch Transporte GmbH" → "fremd-honisch". Das erste Wort des
// Firmennamens genügt zum Wiedererkennen und bleibt kurz genug zum Abtippen.
function baseUsername(label: string): string {
  const firstWord = label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .find((part) => part.length > 0) ?? "";

  const candidate = `fremd-${firstWord.slice(0, 20)}`;
  return firstWord && isValidUsername(candidate) ? candidate : `fremd-${randomSuffix()}`;
}

// Heute in Wien als YYYY-MM-DD — der Zugang gilt bis 23:59 Wiener Zeit.
function viennaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}

class UsernameTakenError extends Error {}

// Legt das Auth-Konto an. Beim selbst gebildeten Namen wird bei Bedarf
// durchnummeriert: fremd-honisch, fremd-honisch-2, fremd-honisch-3, … Hat
// der Chef den Namen gewählt, bleibt es bei genau diesem — sonst hießen
// zwei Zugänge fast gleich und ließen sich verwechseln.
async function createAuthUser(
  adminClient: SupabaseClient,
  base: string,
  password: string,
  allowNumbering: boolean
): Promise<{ userId: string; username: string }> {
  const maxAttempts = allowNumbering ? 20 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const username = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
    });

    if (!error && data.user) {
      return { userId: data.user.id, username };
    }
    if (!error?.message.toLowerCase().includes("already")) {
      throw new Error(error?.message ?? "Could not create user");
    }
  }
  throw new UsernameTakenError(
    allowNumbering
      ? "Kein freier Benutzername gefunden"
      : `Der Benutzername „${base}“ ist schon vergeben`
  );
}

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

  let body: { label?: string; username?: string; expiresOn?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const label = body.label?.trim() ?? "";
  const expiresOn = body.expiresOn?.trim() ?? "";
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";

  if (!label) {
    return json({ error: "Bitte einen Namen für den Zugang angeben" }, 400);
  }
  if (label.length > 100) {
    return json({ error: "Der Name darf höchstens 100 Zeichen lang sein" }, 400);
  }
  if (username && !isValidUsername(username)) {
    return json(
      { error: "Benutzername: 3–32 Zeichen, nur Buchstaben, Ziffern, . _ -" },
      400
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(Date.parse(expiresOn))) {
    return json({ error: "Ungültiges Ablaufdatum" }, 400);
  }
  if (expiresOn < viennaToday()) {
    return json({ error: "Das Ablaufdatum liegt in der Vergangenheit" }, 400);
  }

  const password = randomPassword();

  let created: { userId: string; username: string };
  try {
    created = username
      ? await createAuthUser(adminClient, username, password, false)
      : await createAuthUser(adminClient, baseUsername(label), password, true);
  } catch (createError) {
    const taken = createError instanceof UsernameTakenError;
    return json({ error: (createError as Error).message }, taken ? 409 : 400);
  }

  // Rolle und Zugang. Scheitert einer der beiden Schritte, das Konto wieder
  // entfernen — ein Konto ohne Rolle käme ohnehin nirgends hinein, stünde
  // aber als Leiche in der Benutzerliste. profiles und
  // external_driver_accounts verschwinden dabei per Cascade mit.
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: created.userId, role: "external_driver" });

  const { error: accountError } = profileError
    ? { error: profileError }
    : await adminClient.from("external_driver_accounts").insert({
        user_id: created.userId,
        username: created.username,
        label,
        expires_on: expiresOn,
        created_by: caller.id,
      });

  if (profileError || accountError) {
    await adminClient.auth.admin.deleteUser(created.userId);
    return json({ error: (profileError ?? accountError)!.message }, 500);
  }

  return json({
    success: true,
    userId: created.userId,
    username: created.username,
    password,
    label,
    expiresOn,
  });
});
