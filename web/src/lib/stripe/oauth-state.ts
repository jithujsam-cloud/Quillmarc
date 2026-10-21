// The OAuth state lives in a short-lived httpOnly cookie, tied to the signed-in founder.
// The callback refuses any reply whose state does not match, which stops a stranger from
// linking their Stripe account to your Quillmarc account (CSRF).
export const STATE_COOKIE = "qm_stripe_oauth";
export const STATE_MAX_AGE = 600;

export type ReturnTo = "onboarding" | "settings";

export interface OAuthState {
  state: string;
  userId: string;
  returnTo: ReturnTo;
}

export function encodeState(s: OAuthState): string {
  return Buffer.from(JSON.stringify(s)).toString("base64url");
}

export function decodeState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64url").toString()) as Partial<OAuthState>;
    if (typeof s.state !== "string" || typeof s.userId !== "string") return null;
    return { state: s.state, userId: s.userId, returnTo: s.returnTo === "settings" ? "settings" : "onboarding" };
  } catch {
    return null;
  }
}

/** Where to send the founder afterwards. */
export function returnPath(to: ReturnTo, code: string): string {
  if (to === "settings") return `/settings?stripe=${code}`;
  return code === "connected" ? `/onboarding?step=2&stripe=${code}` : `/onboarding?step=1&stripe=${code}`;
}
