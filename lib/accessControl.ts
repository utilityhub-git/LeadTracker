/** Emails allowed to register and sign in (normalized lowercase). */
export const ALLOWED_EMAILS = new Set([
  "mudit.gupta@utilityhub.com.au",
  "aseem.gupta@utilityhub.com.au",
  "ishu.gupta@utilityhub.com.au",
  "qa@utilityhub.com.au",
  "loans@ezycapital.com.au",
  "debarchan.mukherjee@utilityhub.com.au",
  "bipasha.roy@messold.com",
]);

/** Admins can revoke/restore dashboard access for non-admin users. */
export const ADMIN_EMAILS = new Set([
  "mudit.gupta@utilityhub.com.au",
  "aseem.gupta@utilityhub.com.au",
  "ishu.gupta@utilityhub.com.au",
  "bipasha.roy@messold.com",
]);

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_EMAILS.has(normalizeAuthEmail(email));
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(normalizeAuthEmail(email));
}

export function userHasAccess(hasAccess: boolean | undefined | null): boolean {
  return hasAccess !== false;
}
