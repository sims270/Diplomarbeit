// ============================================================================
// update-external-driver — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/update-external-driver/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts, _shared/email.ts, _shared/verify-boss.ts stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
//
// Sobald die Supabase CLI eingerichtet ist, ist die Repo-Fassung die
// massgebliche und diese Datei wird nicht mehr gebraucht.
// ============================================================================

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

// ---------------------------------------------------------------- die Function
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
