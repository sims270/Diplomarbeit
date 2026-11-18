// Supabase Edge Function: update-driver
//
// Lets an authenticated "boss" account change a driver's username and/or
// password. Both fields are optional — send only what should change.
//
// Deploy: supabase functions deploy update-driver

import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
import { isValidUsername, usernameToEmail } from "../_shared/email.ts";
import { getRole, verifyBoss } from "../_shared/verify-boss.ts";

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
  if (typeof userId !== "string" || !userId) {
    return json({ error: "userId is required" }, 400);
  }
  if (
    (username !== undefined && typeof username !== "string") ||
    (password !== undefined && typeof password !== "string") ||
    (licensePlate !== undefined && typeof licensePlate !== "string")
  ) {
    return json({ error: "username, password and licensePlate must be text" }, 400);
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
  if ((await getRole(adminClient, userId)) !== "driver") {
    return json({ error: "That account is not a driver" }, 403);
  }

  const updates: {
    email?: string;
    password?: string;
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
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }
    updates.password = password;
  }

  const plate = licensePlate?.trim().toUpperCase();
  if (plate !== undefined && plate.length > 15) {
    return json({ error: "License plate must be at most 15 characters" }, 400);
  }

  if (updates.email || updates.password) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      updates
    );

    if (updateError) {
      if (updateError.message.toLowerCase().includes("already")) {
        return json({ error: "That username is already taken" }, 400);
      }
      return internalError("update-driver", updateError);
    }
  }

  // In public.profiles statt im user_metadata: Das könnte der Fahrer selbst
  // ändern.
  if (plate !== undefined) {
    const { error: plateError } = await adminClient
      .from("profiles")
      .update({ license_plate: plate || null })
      .eq("id", userId);

    if (plateError) {
      return internalError("update-driver", plateError);
    }
  }

  return json({ success: true });
});
