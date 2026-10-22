// Small server-side validators. Every input from a form or request goes through one of these.

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,63}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmail(raw: string): boolean {
  const e = raw.trim();
  return e.length >= 3 && e.length <= 254 && EMAIL.test(e) && !e.includes("..");
}

const NO_REPLY = /^(no-?reply|do-?not-?reply|noreply|bounce|mailer-daemon|postmaster)([+._-].*)?@/i;

/** Addresses that are not a person's inbox. A reply-to must be a real inbox. */
export function isNoReplyAddress(email: string): boolean {
  return NO_REPLY.test(email.trim());
}

/** Trim, collapse control characters, cap length. Returns null when empty after trimming. */
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** For email headers: no line breaks, quotes or angle brackets. */
export function headerSafe(raw: string): string {
  return raw.replace(/[\r\n"<>\\]/g, "").trim();
}

export function isMonth(raw: unknown): raw is string {
  return typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw);
}

export function isUuid(raw: unknown): raw is string {
  return typeof raw === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
}

export const PASSWORD_MIN = 8;
/** bcrypt, which Supabase uses, ignores everything after 72 bytes. */
export const PASSWORD_MAX = 72;

/** Why this password cannot be used, in a sentence. Null when it is fine. Length only: no rules about symbols. */
export function passwordProblem(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return "Enter a password.";
  if (raw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  return null;
}

/** Where to go after a link from an email. Only pages we name, never an address from the link itself. */
export function afterEmailLink(raw: unknown): "/dashboard" | "/reset-password" {
  return raw === "/reset-password" ? "/reset-password" : "/dashboard";
}
