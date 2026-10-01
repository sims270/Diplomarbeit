// ============================================================================
// delete-boss — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/delete-boss/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
// ============================================================================

// Supabase Edge Function: delete-boss
//
// Lets an authenticated "boss" account delete another "boss" account.
//
// Zwei Sperren, die beide serverseitig sitzen — die App prüft dasselbe noch
// einmal, aber verlassen darf man sich darauf nicht:
//
//   1. Niemand löscht sein eigenes Konto. Sonst wäre man mitten im Betrieb
//      ausgesperrt, mit laufender Sitzung und ohne Zugang.
//   2. Der letzte Chef bleibt. Ohne Chef kommt niemand mehr an die
//      Fahrer- und LKW-Verwaltung — das ließe sich nur noch im
//      Supabase-Dashboard reparieren.
//
// Deploy: supabase functions deploy delete-boss

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

  const { caller, adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient || !caller) {
    return json({ error }, status ?? 401);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { userId } = body;
  if (!userId) {
    return json({ error: "userId is required" }, 400);
  }

  if (userId === caller.id) {
    return json({ error: "CANNOT_DELETE_SELF" }, 400);
  }

  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Account not found" }, 404);
  }

  // Nur Chef-Konten: Fahrer werden über delete-driver entfernt, damit die
  // dortigen Regeln gelten.
  if ((await getRole(adminClient, userId)) !== "boss") {
    return json({ error: "That account is not a boss" }, 403);
  }

  const { count, error: countError } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "boss");

  if (countError) {
    return json({ error: countError.message }, 400);
  }
  if ((count ?? 0) <= 1) {
    return json({ error: "CANNOT_DELETE_LAST_BOSS" }, 400);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  return json({ success: true });
});
