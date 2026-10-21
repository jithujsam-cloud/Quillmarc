import { describe, expect, it } from "vitest";
import { accountName, authorizeUrl, ConnectAccountSource, deauthorize, exchangeCode } from "@/lib/stripe/connect";
import { decodeState, encodeState, returnPath } from "@/lib/stripe/oauth-state";
import { connectMessage } from "@/lib/stripe/connect-messages";
import { StripeFetchError, type FetchLike } from "@/lib/stripe/restricted-key";
import fixture from "../fixtures/stripe/subscription-annual-discount.json";

const cfg = { clientId: "ca_test123", secretKey: "sk_test_platform", redirectUri: "https://app.example.com/api/stripe/callback" };

function fake(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { f, calls };
}

describe("authorizeUrl", () => {
  it("asks for read_only only, with state and redirect", () => {
    const u = new URL(authorizeUrl(cfg, "state123"));
    expect(u.origin + u.pathname).toBe("https://connect.stripe.com/oauth/authorize");
    expect(u.searchParams.get("scope")).toBe("read_only");
    expect(u.searchParams.get("client_id")).toBe("ca_test123");
    expect(u.searchParams.get("state")).toBe("state123");
    expect(u.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
    expect(u.searchParams.get("response_type")).toBe("code");
  });
});

describe("exchangeCode", () => {
  it("returns the account for a read_only grant, using the platform key as basic auth", async () => {
    const { f, calls } = fake(200, { scope: "read_only", stripe_user_id: "acct_123ABC", livemode: true, access_token: "sk_live_secret", refresh_token: "rt_x" });
    const r = await exchangeCode(cfg, "ac_abc123", f);
    expect(r).toEqual({ ok: true, accountId: "acct_123ABC", livemode: true });
    expect(JSON.stringify(r)).not.toContain("sk_live_secret"); // tokens are dropped
    const h = calls[0].init!.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Basic ${Buffer.from("sk_test_platform:").toString("base64")}`);
    expect(String(calls[0].init!.body)).toBe("grant_type=authorization_code&code=ac_abc123");
  });

  it("refuses any scope but read_only", async () => {
    const { f } = fake(200, { scope: "read_write", stripe_user_id: "acct_123" });
    expect(await exchangeCode(cfg, "ac_abc", f)).toEqual({ ok: false, code: "scope" });
  });

  it("refuses malformed codes without calling Stripe", async () => {
    const { f, calls } = fake(200, {});
    expect(await exchangeCode(cfg, "javascript:alert(1)", f)).toEqual({ ok: false, code: "expired" });
    expect(calls).toHaveLength(0);
  });

  it("maps Stripe errors", async () => {
    expect(await exchangeCode(cfg, "ac_abc", fake(400, { error: "invalid_grant" }).f)).toEqual({ ok: false, code: "expired" });
    expect(await exchangeCode(cfg, "ac_abc", fake(503, {}).f)).toEqual({ ok: false, code: "failed" });
    expect(await exchangeCode(cfg, "ac_abc", fake(200, { scope: "read_only", stripe_user_id: "nope" }).f)).toEqual({ ok: false, code: "expired" });
  });
});

describe("account name and deauthorize", () => {
  it("reads the dashboard display name", async () => {
    expect(await accountName(cfg, "acct_1", fake(200, { settings: { dashboard: { display_name: "Ledgerlane" } } }).f)).toBe("Ledgerlane");
    expect(await accountName(cfg, "acct_1", fake(403, {}).f)).toBeNull();
  });

  it("revokes access with client id and account", async () => {
    const { f, calls } = fake(200, { stripe_user_id: "acct_1" });
    expect(await deauthorize(cfg, "acct_1", f)).toBe(true);
    expect(String(calls[0].init!.body)).toBe("client_id=ca_test123&stripe_user_id=acct_1");
  });
});

describe("ConnectAccountSource", () => {
  it("reads subscriptions on the connected account with the Stripe-Account header", async () => {
    const { f, calls } = fake(200, { data: [fixture], has_more: false });
    const data = await new ConnectAccountSource("sk_test_platform", "acct_123", f).fetchBillingData();
    expect(data.subscriptions).toHaveLength(1);
    const h = calls[0].init!.headers as Record<string, string>;
    expect(h["Stripe-Account"]).toBe("acct_123");
    expect(h.Authorization).toBe("Bearer sk_test_platform");
  });

  it("explains revoked access in plain words", async () => {
    await expect(new ConnectAccountSource("sk", "acct_1", fake(401, {}).f).fetchBillingData()).rejects.toThrow("Stripe access was removed");
    expect(new StripeFetchError(403, "key").message).toContain("missing a read permission");
  });
});

describe("oauth state", () => {
  it("round-trips and rejects junk", () => {
    const s = { state: "abc", userId: "u1", returnTo: "settings" as const };
    expect(decodeState(encodeState(s))).toEqual(s);
    expect(decodeState("not-base64-json")).toBeNull();
    expect(decodeState(undefined)).toBeNull();
  });

  it("sends the founder back to the right place", () => {
    expect(returnPath("onboarding", "connected")).toBe("/onboarding?step=2&stripe=connected");
    expect(returnPath("onboarding", "denied")).toBe("/onboarding?step=1&stripe=denied");
    expect(returnPath("settings", "denied")).toBe("/settings?stripe=denied");
  });

  it("shows only known messages", () => {
    expect(connectMessage("connected")).toEqual({ ok: true, text: expect.stringContaining("read-only") });
    expect(connectMessage("<script>")).toBeNull();
  });
});
