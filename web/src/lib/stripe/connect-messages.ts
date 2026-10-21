// Shared with the browser. The callback redirects with one of these codes, never with raw text.
export const CONNECT_MESSAGES = {
  connected: "Stripe is connected with read-only access.",
  denied: "Stripe was not connected. You cancelled on Stripe's page.",
  expired: "The approval from Stripe expired or did not match. Try connecting again.",
  scope: "Stripe granted more than read-only access, so Quillmarc refused it. Try again.",
  unavailable: "Connect with Stripe is not set up on this server yet. Paste a restricted key instead.",
  failed: "Stripe could not be reached. Try again in a minute.",
  busy: "Too many attempts. Wait a few minutes and try again.",
} as const;

export type ConnectCode = keyof typeof CONNECT_MESSAGES;

export function connectMessage(code: string | undefined): { ok: boolean; text: string } | null {
  if (!code || !(code in CONNECT_MESSAGES)) return null;
  return { ok: code === "connected", text: CONNECT_MESSAGES[code as ConnectCode] };
}
