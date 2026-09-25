// ============================================================================
// create-external-driver — EIGENSTAENDIGE FASSUNG FUER DAS SUPABASE-DASHBOARD
// ============================================================================
//
// AUTOMATISCH ERZEUGT aus supabase/functions/create-external-driver/index.ts —
// nicht direkt bearbeiten. Aenderungen gehoeren in die Repo-Fassung; diese
// Datei wird daraus neu gebaut.
//
// Unterschied: die Helfer aus _shared/cors.ts, _shared/email.ts und
// _shared/verify-boss.ts stehen hier inline. Der
// Dashboard-Editor legt die eingefuegte Datei allein unter
// /tmp/.../source/index.ts ab, relative Imports laufen dort ins Leere.
//
// Sobald die Supabase CLI eingerichtet ist, ist die Repo-Fassung die
// massgebliche und diese Datei wird nicht mehr gebraucht.
// ============================================================================

// Supabase Edge Function: create-external-driver
//
// Lets an authenticated "boss" account create a time-limited account for a
// subcontractor's driver ("fremder Fahrer"). Der Chef gibt nur den
// Firmennamen und das Ablaufdatum an; Benutzername und Passwort entstehen
// hier. Welche Fremdaufträge der Zugang sieht, weist die App danach
// getrennt zu (external_orders.assigned_external_user_id).
//
// Das Passwort wird in public.external_driver_accounts gespeichert, damit
// der Chef es später erneut anzeigen kann (siehe
// supabase/migrations/20260915130000_external_driver_access.sql).
//
// Deploy: supabase functions deploy create-external-driver

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
// Ohne Zeichen, die sich beim Abtippen verwechseln lassen (0/O, 1/l/I).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const PASSWORD_LENGTH = 12;

function randomPassword(): string {
  // Nur Bytes unterhalb des größten Vielfachen der Alphabetlänge verwenden,
  // sonst kämen die ersten Zeichen des Alphabets häufiger vor.
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let password = "";
  while (password.length < PASSWORD_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH * 2));
    for (const byte of bytes) {
      if (byte < limit && password.length < PASSWORD_LENGTH) {
        password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      }
    }
  }
  return password;
}

function randomSuffix(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// "Honisch Transporte GmbH" → "fremd-honisch". Das erste Wort des
// Firmennamens genügt zum Wiedererkennen und bleibt kurz genug zum Abtippen.
function baseUsername(label: string): string {
  const firstWord = label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .find((part) => part.length > 0) ?? "";

  const candidate = `fremd-${firstWord.slice(0, 20)}`;
  return firstWord && isValidUsername(candidate) ? candidate : `fremd-${randomSuffix()}`;
}

// Heute in Wien als YYYY-MM-DD — der Zugang gilt bis 23:59 Wiener Zeit.
function viennaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}

// Legt das Auth-Konto an. Ist der Benutzername schon vergeben, wird
// durchnummeriert: fremd-honisch, fremd-honisch-2, fremd-honisch-3, …
async function createAuthUser(
  adminClient: SupabaseClient,
  base: string,
  password: string
): Promise<{ userId: string; username: string }> {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const username = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
    });

    if (!error && data.user) {
      return { userId: data.user.id, username };
    }
    if (!error?.message.toLowerCase().includes("already")) {
      throw new Error(error?.message ?? "Could not create user");
    }
  }
  throw new Error("Kein freier Benutzername gefunden");
}

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

  let body: { label?: string; expiresOn?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const label = body.label?.trim() ?? "";
  const expiresOn = body.expiresOn?.trim() ?? "";

  if (!label) {
    return json({ error: "Bitte einen Namen für den Zugang angeben" }, 400);
  }
  if (label.length > 100) {
    return json({ error: "Der Name darf höchstens 100 Zeichen lang sein" }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(Date.parse(expiresOn))) {
    return json({ error: "Ungültiges Ablaufdatum" }, 400);
  }
  if (expiresOn < viennaToday()) {
    return json({ error: "Das Ablaufdatum liegt in der Vergangenheit" }, 400);
  }

  const password = randomPassword();

  let created: { userId: string; username: string };
  try {
    created = await createAuthUser(adminClient, baseUsername(label), password);
  } catch (createError) {
    return json({ error: (createError as Error).message }, 400);
  }

  // Rolle und Zugang. Scheitert einer der beiden Schritte, das Konto wieder
  // entfernen — ein Konto ohne Rolle käme ohnehin nirgends hinein, stünde
  // aber als Leiche in der Benutzerliste. profiles und
  // external_driver_accounts verschwinden dabei per Cascade mit.
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: created.userId, role: "external_driver" });

  const { error: accountError } = profileError
    ? { error: profileError }
    : await adminClient.from("external_driver_accounts").insert({
        user_id: created.userId,
        username: created.username,
        password,
        label,
        expires_on: expiresOn,
        created_by: caller.id,
      });

  if (profileError || accountError) {
    await adminClient.auth.admin.deleteUser(created.userId);
    return json({ error: (profileError ?? accountError)!.message }, 500);
  }

  return json({
    success: true,
    userId: created.userId,
    username: created.username,
    password,
    label,
    expiresOn,
  });
});
