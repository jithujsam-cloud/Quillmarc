// Phase 1 connection: a restricted, read-only Stripe API key pasted by the founder.
// Rules: never log the key, never log or store a Stripe response, never send the key to the browser.
import type { BillingSource } from "./adapter";
import { normalizeSubscription } from "./normalize";
import type { BillingData, NormalizedSubscription } from "./types";

// STRIPE_API_BASE is for the local test stack only. Leave it unset everywhere else.
export const API = process.env.STRIPE_API_BASE ?? "https://api.stripe.com/v1";
// Pinned so the response shape does not change under us.
export const STRIPE_VERSION = "2024-06-20";
const MAX_PAGES = 100;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export { REQUIRED_READ_PERMISSIONS } from "./permissions";

const READ_CHECKS: { label: string; path: string }[] = [
  { label: "Customers", path: "/customers?limit=1" },
  { label: "Subscriptions", path: "/subscriptions?limit=1&status=all" },
  { label: "Prices", path: "/prices?limit=1" },
  { label: "Invoices", path: "/invoices?limit=1" },
  { label: "Charges", path: "/charges?limit=1" },
];

// Write probes update an object that does not exist. A read-only key gets 403 (no permission).
// A key with write access gets 404 (allowed, but no such object). Nothing is ever changed.
const WRITE_CHECKS: { label: string; path: string }[] = [
  { label: "Customers", path: "/customers/cus_quillmarc_probe" },
  { label: "Subscriptions", path: "/subscriptions/sub_quillmarc_probe" },
  { label: "Prices", path: "/prices/price_quillmarc_probe" },
  { label: "Products", path: "/products/prod_quillmarc_probe" },
  { label: "Invoices", path: "/invoices/in_quillmarc_probe" },
  { label: "Charges", path: "/charges/ch_quillmarc_probe" },
  { label: "Refunds", path: "/refunds/re_quillmarc_probe" },
];

export type KeyCheck =
  | { ok: true; mode: "test" | "live"; last4: string }
  | { ok: false; error: string };

function headers(key: string): HeadersInit {
  return { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION };
}

export function checkKeyFormat(raw: string): KeyCheck {
  const key = raw.trim();
  if (/^sk_(test|live)_/.test(key)) {
    return { ok: false, error: "This is a secret key. It has full write access. Create a restricted key with read permissions only." };
  }
  if (/^pk_(test|live)_/.test(key)) {
    return { ok: false, error: "This is a publishable key. Paste a restricted key. It starts with rk_live_ or rk_test_." };
  }
  const m = /^rk_(test|live)_[A-Za-z0-9]{16,}$/.exec(key);
  if (!m) return { ok: false, error: "That does not look like a restricted key. It starts with rk_live_ or rk_test_." };
  return { ok: true, mode: m[1] as "test" | "live", last4: key.slice(-4) };
}

/** Checks the key reads what we need and cannot write. Makes only GET calls and write probes that cannot change anything. */
export async function validateRestrictedKey(raw: string, fetchImpl: FetchLike = fetch): Promise<KeyCheck> {
  const format = checkKeyFormat(raw);
  if (!format.ok) return format;
  const key = raw.trim();

  try {
    for (const check of READ_CHECKS) {
      const res = await fetchImpl(API + check.path, { headers: headers(key) });
      if (res.status === 401) return { ok: false, error: "Stripe did not accept this key. Check it was copied in full and has not been deleted." };
      if (res.status === 403) return { ok: false, error: `This key cannot read ${check.label}. Set ${check.label} to Read in the key's permissions.` };
      if (!res.ok) return { ok: false, error: "Stripe returned an error. Try again in a minute." };
    }
    for (const check of WRITE_CHECKS) {
      const res = await fetchImpl(API + check.path, {
        method: "POST",
        headers: { ...headers(key), "Content-Type": "application/x-www-form-urlencoded" },
        body: "",
      });
      if (res.status === 403) continue;
      if (res.status === 404 || res.ok || res.status === 400) {
        return { ok: false, error: `This key can write to ${check.label}. Quillmarc only accepts read-only keys. Set every permission to Read or None.` };
      }
      return { ok: false, error: "Stripe returned an error while checking permissions. Try again in a minute." };
    }
  } catch {
    return { ok: false, error: "Could not reach Stripe. Check your connection and try again." };
  }
  return format;
}

/**
 * Read every subscription. `key` is a restricted key, or the platform key when `account` is set
 * (Stripe Connect). With `account`, Stripe limits the request to what the founder granted: read_only.
 */
export async function fetchSubscriptions(opts: { key: string; account?: string; fetchImpl?: FetchLike; kind: StripeFetchError["kind"] }): Promise<BillingData> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const h: Record<string, string> = { Authorization: `Bearer ${opts.key}`, "Stripe-Version": STRIPE_VERSION };
  if (opts.account) h["Stripe-Account"] = opts.account;
  const subscriptions: NormalizedSubscription[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: "100", status: "all" });
    params.append("expand[]", "data.discounts");
    if (startingAfter) params.set("starting_after", startingAfter);
    const res = await fetchImpl(`${API}/subscriptions?${params}`, { headers: h });
    if (!res.ok) throw new StripeFetchError(res.status, opts.kind);
    const body = (await res.json()) as { data: Record<string, unknown>[]; has_more: boolean };
    for (const s of body.data) subscriptions.push(normalizeSubscription(s));
    if (!body.has_more || body.data.length === 0) break;
    startingAfter = String(body.data[body.data.length - 1].id);
  }
  return { subscriptions, sample: false };
}

export class RestrictedKeySource implements BillingSource {
  method = "restricted_key" as const;

  constructor(
    private readonly key: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  fetchBillingData(): Promise<BillingData> {
    return fetchSubscriptions({ key: this.key, fetchImpl: this.fetchImpl, kind: "key" });
  }
}

/** Carries only the HTTP status, never the response body. */
export class StripeFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly kind: "key" | "connect" = "key",
  ) {
    super(
      status === 401 || (kind === "connect" && status === 403)
        ? kind === "connect"
          ? "Stripe access was removed. Connect Stripe again in Settings."
          : "Stripe no longer accepts this key. Connect Stripe again in Settings."
        : status === 403
          ? "This key is missing a read permission. Check the key's permissions in Stripe."
          : "Stripe returned an error. Try again in a minute.",
    );
    this.name = "StripeFetchError";
  }
}
