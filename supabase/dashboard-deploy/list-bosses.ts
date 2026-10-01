// ============================================================================
// list-bosses — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/list-bosses/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
// ============================================================================

// Supabase Edge Function: list-bosses
//
// Lists all "boss" accounts. Nur für einen angemeldeten Chef — Fahrer
// haben hier nichts verloren.
//
// Deploy: supabase functions deploy list-bosses

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
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { caller, adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient || !caller) {
    return json({ error }, status ?? 401);
  }

  // Wie list-drivers: eine Seite reicht für dieses Projekt.
  const { data, error: listError } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    return json({ error: listError.message }, 400);
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "boss");

  if (profilesError) {
    return json({ error: profilesError.message }, 400);
  }

  const bossIds = new Set(profiles.map((p) => p.id as string));

  const bosses = data.users
    .filter((u) => bossIds.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.email ? emailToUsername(u.email) : u.id,
      name: (u.user_metadata?.name as string | undefined) ?? "",
      createdAt: u.created_at,
      // Damit die App das eigene Konto kennzeichnen und vor dem Löschen
      // schützen kann, ohne die Benutzer-ID selbst vergleichen zu müssen.
      isSelf: u.id === caller.id,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return json({ bosses });
});
