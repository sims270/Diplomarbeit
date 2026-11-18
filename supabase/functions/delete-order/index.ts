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

import { corsHeaders, json } from "../_shared/cors.ts";
import { internalError } from "../_shared/errors.ts";
import { verifyBoss } from "../_shared/verify-boss.ts";

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
