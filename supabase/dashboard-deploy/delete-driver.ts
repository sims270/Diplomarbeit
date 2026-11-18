// ============================================================================
// delete-driver — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/delete-driver/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts und _shared/verify-boss.ts stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
//
// Sobald die Supabase CLI eingerichtet ist, ist die Repo-Fassung die
// massgebliche und diese Datei wird nicht mehr gebraucht.
// ============================================================================

// Supabase Edge Function: delete-driver
//
// Lets an authenticated "boss" account permanently delete a "driver"
// account. Confirmation happens client-side before this is ever called.
//
// Deploy: supabase functions deploy delete-driver

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
    console.error("[verify-boss]", roleError);
    return { error: INTERNAL_ERROR_MESSAGE, status: 500 };
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

  // Only ever delete driver accounts through this endpoint — never lets a
  // boss accidentally (or via a tampered request) delete a boss account.
  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Driver not found" }, 404);
  }
  if ((await getRole(adminClient, userId)) !== "driver") {
    return json({ error: "That account is not a driver" }, 403);
  }

  // Supabase löscht kein Konto, dem noch Dateien im Storage gehören. Die
  // hochgeladenen Belege gehören aber zum Auftrag und bleiben erhalten.
  const { error: releaseError } = await adminClient.rpc("release_storage_ownership", {
    uid: userId,
  });
  if (releaseError) {
    return internalError("delete-driver", releaseError);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return internalError("delete-driver", deleteError);
  }

  // Erst nach dem Löschen: Scheitert es, bleiben die Zuweisungen unberührt.
  // Die Datenbank hat assigned_to geleert (20261118120000), offene Aufträge
  // müssen wieder als "noch zuzuweisen" gelten.
  const { error: reopenError } = await adminClient
    .from("orders")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .is("assigned_to", null)
    .in("status", ["assigned", "in_progress"]);
  if (reopenError) {
    return internalError("delete-driver", reopenError);
  }

  return json({ success: true });
});
