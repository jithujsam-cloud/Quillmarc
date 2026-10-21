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
