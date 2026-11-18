// ============================================================================
// create-driver — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/create-driver/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts, _shared/email.ts und
// _shared/verify-boss.ts stehen hier inline. Der Dashboard-Editor legt die
// eingefuegte Datei allein unter /tmp/.../source/index.ts ab, relative
// Imports laufen dort ins Leere.
//
// Sobald die Supabase CLI eingerichtet ist, ist die Repo-Fassung die
// massgebliche und diese Datei wird nicht mehr gebraucht.
// ============================================================================

// Supabase Edge Function: create-driver
//
// Lets an authenticated "boss" account create a new "driver" account with
// a username + password and an optional license plate (no email — see
// _shared/email.ts for why).

import {
  createClient,
  type SupabaseClient,
  type User,
} from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------- _shared/cors
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -------------------------------------------------------------- _shared/errors
const INTERNAL_ERROR_MESSAGE = "Interner Fehler. Bitte später erneut versuchen.";

// Meldungen von Postgres und Auth verraten Tabellen- und Constraint-Namen.
// Die Details landen deshalb nur im Log der Function.
function internalError(context: string, cause: unknown): Response {
  console.error(`[${context}]`, cause);
  return json({ error: INTERNAL_ERROR_MESSAGE }, 500);
}

// --------------------------------------------------------------- _shared/email
const ACCOUNT_EMAIL_DOMAIN = "accounts.translogpro.internal";
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`;
}

// --------------------------------------------------------- _shared/verify-boss
interface VerifyBossResult {
  caller?: User;
  adminClient?: SupabaseClient;
  error?: string;
  status?: number;
}

async function verifyBoss(req: Request): Promise<VerifyBossResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Missing Authorization header", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return { error: "Invalid or expired session", status: 401 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Die Rolle aus public.profiles, nicht aus dem user_metadata — das kann
  // jeder Nutzer selbst ändern.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    console.error("[verify-boss]", profileError);
    return { error: INTERNAL_ERROR_MESSAGE, status: 500 };
  }
  if (profile?.role !== "boss") {
    return { error: "Only a boss account can do this", status: 403 };
  }

  return { caller, adminClient };
}

// ----------------------------------------------------------------- die Function
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
