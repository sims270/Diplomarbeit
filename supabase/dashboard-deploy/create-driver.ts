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

  if (caller.user_metadata?.role !== "boss") {
    return { error: "Only a boss account can do this", status: 403 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
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

  // Das Kennzeichen ist optional: Der Chef legt einen Fahrer oft an, bevor
  // feststeht, welchen LKW er fährt. Kennzeichen sind in Österreich immer
  // in Großbuchstaben — einheitlich gespeichert, damit später ein
  // Vergleich mit dem Tanklisten-Eintrag nicht an der Schreibweise
  // scheitert.
  const plate = licensePlate?.trim().toUpperCase() ?? "";
  if (plate.length > 15) {
    return json({ error: "License plate must be at most 15 characters" }, 400);
  }

  const { data, error: createError } = await adminClient.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { role: "driver", license_plate: plate },
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
