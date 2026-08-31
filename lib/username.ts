// Supabase Auth requires an email/password pair — there is no built-in
// "username" concept. Since every account here is created by the boss
// (never self-registered), we don't need real email addresses at all, so
// we synthesize one from the username instead and hide that from the UI.
//
// IMPORTANT: this domain must stay identical to the one in
// supabase/functions/_shared/email.ts (Deno side) — both must produce the
// exact same email for the same username, or login will fail.
const ACCOUNT_EMAIL_DOMAIN = "accounts.translogpro.internal";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.split("@")[0];
}
