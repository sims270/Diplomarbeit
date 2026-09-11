// ============================================================================
// update-driver — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/update-driver/index.ts —
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

// Supabase Edge Function: update-driver
//
// Lets an authenticated "boss" account change a driver's username,
// password and/or license plate. All three are optional — send only what
// should change.

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

  let body: {
    userId?: string;
    username?: string;
    password?: string;
    licensePlate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { userId, username, password, licensePlate } = body;
  if (!userId) {
    return json({ error: "userId is required" }, 400);
  }
  // Beim Kennzeichen zählt "wurde mitgeschickt", nicht "ist nicht leer" —
  // sonst ließe sich ein falsch eingetragenes Kennzeichen nie wieder
  // löschen.
  if (!username && !password && licensePlate === undefined) {
    return json(
      { error: "Provide a new username, password and/or license plate" },
      400
    );
  }

  // Only edit driver accounts through this endpoint — never lets a boss
  // accidentally (or maliciously, via a tampered request) touch another
  // boss account.
  const { data: existing, error: fetchError } =
    await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return json({ error: "Driver not found" }, 404);
  }
  if (existing.user.user_metadata?.role !== "driver") {
    return json({ error: "That account is not a driver" }, 403);
  }

  const updates: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, unknown>;
  } = {};

  if (username) {
    if (!isValidUsername(username)) {
      return json(
        { error: "Username must be 3-32 characters: letters, numbers, . _ -" },
        400
      );
    }
    updates.email = usernameToEmail(username);
  }

  if (password) {
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }
    updates.password = password;
  }

  if (licensePlate !== undefined) {
    const plate = licensePlate.trim().toUpperCase();
    if (plate.length > 15) {
      return json({ error: "License plate must be at most 15 characters" }, 400);
    }
    // Die bestehenden Metadaten mitschicken: Sonst fiele beim Speichern
    // die Rolle "driver" weg — und der Fahrer käme nicht mehr in seine
    // Ansichten (und in list-drivers gar nicht mehr vor).
    updates.user_metadata = {
      ...existing.user.user_metadata,
      license_plate: plate,
    };
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    userId,
    updates
  );

  if (updateError) {
    const message = updateError.message.toLowerCase().includes("already")
      ? "That username is already taken"
      : updateError.message;
    return json({ error: message }, 400);
  }

  return json({ success: true });
});
