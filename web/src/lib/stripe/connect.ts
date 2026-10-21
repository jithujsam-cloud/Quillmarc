// Stripe Connect (OAuth) with the read_only scope. The founder approves Quillmarc on Stripe's own
// page; Stripe sends back a code; we swap it for the connected account id. Requests then use the
// platform secret key plus a Stripe-Account header, and Stripe holds them to read_only.
//
// Setup (once, by the Quillmarc owner): Stripe Dashboard, Connect, Settings, Onboarding options,
// OAuth. Turn OAuth on, copy the client id (ca_...), and add <APP_URL>/api/stripe/callback as a
// redirect URI. See README.
import type { BillingSource } from "./adapter";
import { API, fetchSubscriptions, STRIPE_VERSION, type FetchLike } from "./restricted-key";
import type { BillingData } from "./types";

// STRIPE_CONNECT_BASE is for the local test stack only. Leave it unset everywhere else.
const CONNECT = process.env.STRIPE_CONNECT_BASE ?? "https://connect.stripe.com/oauth";

// connect.stripe.com takes the secret key as the basic-auth user, as in Stripe's docs (curl -u sk_...:).
const basic = (secretKey: string) => `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

export interface ConnectConfig {
  clientId: string;
  /** The platform's secret key. Server only. */
  secretKey: string;
  redirectUri: string;
}

export function authorizeUrl(cfg: ConnectConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: "read_only",
    state,
    redirect_uri: cfg.redirectUri,
    // Founders already have a Stripe account, so open on sign-in, not sign-up.
    stripe_landing: "login",
  });
  return `${CONNECT}/authorize?${params}`;
}

export type ExchangeResult = { ok: true; accountId: string; livemode: boolean } | { ok: false; code: "expired" | "scope" | "failed" };

/** Swap the one-time code for the connected account. Refuses anything but the read_only scope. */
export async function exchangeCode(cfg: ConnectConfig, code: string, fetchImpl: FetchLike = fetch): Promise<ExchangeResult> {
  if (!/^ac_[A-Za-z0-9]+$/.test(code)) return { ok: false, code: "expired" };
  let res: Response;
  try {
    res = await fetchImpl(`${CONNECT}/token`, {
      method: "POST",
      headers: { Authorization: basic(cfg.secretKey), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
    });
  } catch {
    return { ok: false, code: "failed" };
  }
  if (res.status >= 500) return { ok: false, code: "failed" };
  if (!res.ok) return { ok: false, code: "expired" };
  const body = (await res.json()) as { scope?: string; stripe_user_id?: string; livemode?: boolean };
  // Only these three fields are read. Tokens in the reply are dropped: the account id is enough.
  if (body.scope !== "read_only") return { ok: false, code: "scope" };
  if (!body.stripe_user_id || !/^acct_[A-Za-z0-9]+$/.test(body.stripe_user_id)) return { ok: false, code: "expired" };
  return { ok: true, accountId: body.stripe_user_id, livemode: Boolean(body.livemode) };
}

/** The account's display name, for Settings. Null if Stripe will not say. */
export async function accountName(cfg: ConnectConfig, accountId: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`${API}/accounts/${accountId}`, { headers: { Authorization: `Bearer ${cfg.secretKey}`, "Stripe-Version": STRIPE_VERSION } });
    if (!res.ok) return null;
    const a = (await res.json()) as { settings?: { dashboard?: { display_name?: string } }; business_profile?: { name?: string } };
    const name = a.settings?.dashboard?.display_name || a.business_profile?.name;
    return name ? name.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/** Revoke Quillmarc's access on Stripe's side. Best effort: the local record is deleted either way. */
export async function deauthorize(cfg: ConnectConfig, accountId: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${CONNECT}/deauthorize`, {
      method: "POST",
      headers: { Authorization: basic(cfg.secretKey), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, stripe_user_id: accountId }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ConnectAccountSource implements BillingSource {
  method = "oauth" as const;

  constructor(
    private readonly secretKey: string,
    private readonly accountId: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  fetchBillingData(): Promise<BillingData> {
    return fetchSubscriptions({ key: this.secretKey, account: this.accountId, fetchImpl: this.fetchImpl, kind: "connect" });
  }
}
