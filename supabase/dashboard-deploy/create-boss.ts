// ============================================================================
// create-boss — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/create-boss/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
// ============================================================================

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
// Keep this identical to lib/username.ts on the app side (React Native /
// Node runtime) — both must derive the exact same synthetic email for the
// same username, or login will fail after the boss creates/renames an
// account here.
const ACCOUNT_EMAIL_DOMAIN = "accounts.translogpro.internal";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`;
}

function emailToUsername(email: string): string {
  return email.split("@")[0];
}

// --------------------------------------------------------- _shared/verify-boss
interface VerifyBossResult {
  caller?: User;
  adminClient?: SupabaseClient;
  error?: string;
  status?: number;
}

// Die Rolle eines Kontos aus public.profiles
// (supabase/migrations/20260915110000_create_profiles.sql). Nicht aus dem
// user_metadata: das kann jeder Nutzer selbst ändern.
async function getRole(
  adminClient: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.role as string | undefined) ?? null;
}

// Confirms the request carries a valid session for a "boss" account, then
// hands back an admin client (service_role) for the caller to use. The
// service_role key never leaves this server-side runtime.
async function verifyBoss(req: Request): Promise<VerifyBossResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Missing Authorization header", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Scoped to the caller's own JWT — only used to find out who's calling.
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

  let role: string | null;
  try {
    role = await getRole(adminClient, caller.id);
  } catch (roleError) {
    return { error: (roleError as Error).message, status: 500 };
  }

  if (role !== "boss") {
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
