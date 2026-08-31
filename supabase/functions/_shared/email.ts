// Keep this identical to lib/username.ts on the app side (React Native /
// Node runtime) — both must derive the exact same synthetic email for the
// same username, or login will fail after the boss creates/renames an
// account here.
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
