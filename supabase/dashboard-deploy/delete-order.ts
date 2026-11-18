// ============================================================================
// delete-order — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/delete-order/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
// ============================================================================

// Supabase Edge Function: delete-order
//
// Löscht einen eigenen Auftrag oder Fremdauftrag samt hochgeladener Belege.
//
// Serverseitig, weil der Chef im Bucket order-documents bewusst keine
// Löschrechte hat und Belege offener Aufträge nicht einmal lesen darf. Erst
// die Zeile, dann die Dateien: Ist der Auftrag verrechnet, lehnt die Datenbank
// das Löschen ab (20261119110000) und die Belege bleiben unberührt.
//
// Deploy: supabase/dashboard-deploy/delete-order.ts im Dashboard einfügen

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
// ----------------------------------------------------------------- die Function
const BUCKET = "order-documents";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  let body: { orderId?: unknown; external?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Die id wird zum Ordnernamen im Bucket, deshalb streng prüfen.
  const { orderId, external } = body;
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) {
    return json({ error: "orderId is required" }, 400);
  }

  const { data: deleted, error: deleteError } = await adminClient
    .from(external === true ? "external_orders" : "orders")
    .delete()
    .eq("id", orderId)
    .select("id");

  if (deleteError) {
    if (deleteError.code === "23503") {
      return json({ error: "ORDER_INVOICED" }, 409);
    }
    return internalError("delete-order", deleteError);
  }
  if (!deleted || deleted.length === 0) {
    return json({ error: "ORDER_NOT_FOUND" }, 404);
  }

  // Der Auftrag ist weg. Bleibt eine Datei liegen, ist das kein Fehler für den
  // Chef mehr, sondern steht nur im Log.
  const { data: files, error: listError } = await adminClient.storage
    .from(BUCKET)
    .list(orderId, { limit: 1000 });

  if (listError) {
    console.error("[delete-order]", listError);
    return json({ success: true });
  }

  // Supabase legt in leeren Ordnern einen Platzhalter ohne id ab.
  const paths = (files ?? [])
    .filter((file) => file.id)
    .map((file) => `${orderId}/${file.name}`);

  if (paths.length > 0) {
    const { error: removeError } = await adminClient.storage.from(BUCKET).remove(paths);
    if (removeError) console.error("[delete-order]", removeError);
  }

  return json({ success: true });
});
