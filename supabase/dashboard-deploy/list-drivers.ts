// ============================================================================
// list-drivers — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/list-drivers/index.ts —
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

// Supabase Edge Function: list-drivers
//
// Lets an authenticated "boss" account list all "driver" accounts, so the
// UI can show existing drivers (with their license plate) and let the boss
// edit them.

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
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { adminClient, error, status } = await verifyBoss(req);
  if (error || !adminClient) {
    return json({ error }, status ?? 401);
  }

  // Fine for this project's scale — paginate if the fleet ever exceeds
  // a single page (Supabase defaults to 50 users per page).
  const { data, error: listError } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  if (listError) {
    return internalError("list-drivers", listError);
  }

  // Wer Fahrer ist, steht in public.profiles — fremde Fahrer und der Chef
  // gehören nicht in diese Liste.
  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id, license_plate")
    .eq("role", "driver");

  if (profilesError) {
    return internalError("list-drivers", profilesError);
  }

  const platesByDriver = new Map(
    profiles.map((p) => [p.id as string, (p.license_plate as string | null) ?? ""])
  );

  const drivers = data.users
    .filter((u) => platesByDriver.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.email ? emailToUsername(u.email) : u.id,
      licensePlate: platesByDriver.get(u.id) ?? "",
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return json({ drivers });
});
