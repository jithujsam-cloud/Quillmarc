// Verifies Svix webhook signatures (Resend signs its webhooks with Svix).
// signed content = "<svix-id>.<svix-timestamp>.<raw body>", HMAC-SHA256 with the base64 secret after "whsec_".
import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function signSvix(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvix(secret: string, headers: SvixHeaders, body: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(signSvix(secret, id, ts, body).slice(3), "base64");
  // The header can hold several space-separated signatures during secret rotation.
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
