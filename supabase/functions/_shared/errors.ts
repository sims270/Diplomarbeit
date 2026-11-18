import { json } from "./cors.ts";

export const INTERNAL_ERROR_MESSAGE = "Interner Fehler. Bitte später erneut versuchen.";

// Meldungen von Postgres und Auth verraten Tabellen- und Constraint-Namen.
// Die Details landen deshalb nur im Log der Function.
export function internalError(context: string, cause: unknown): Response {
  console.error(`[${context}]`, cause);
  return json({ error: INTERNAL_ERROR_MESSAGE }, 500);
}
