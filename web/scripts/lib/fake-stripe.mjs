// A tiny stand-in for Stripe Connect and the subscriptions API. Local test stack only.
// It approves at once (no Stripe page), and checks the same things the real one would:
// basic auth with the platform key, the read_only scope, and the Stripe-Account header.
import http from "node:http";

export const FAKE = { clientId: "ca_localfake", secretKey: "sk_test_localfake", account: "acct_localfake1", code: "ac_localfake" };

function subscription(i, startDays) {
  const start = Math.floor(Date.now() / 1000) - startDays * 86400;
  return {
    id: `sub_fake_${i}`, customer: `cus_fake_${i}`, status: "active", currency: "usd", created: start, start_date: start,
    ended_at: null, trial_end: null, pause_collection: null, discount: null, discounts: [],
    items: { data: [{ quantity: 1, price: { id: "price_fake", currency: "usd", unit_amount: 25000, billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } } }] },
  };
}

export function startFakeStripe(port) {
  const basicOk = (req) => req.headers.authorization === `Basic ${Buffer.from(`${FAKE.secretKey}:`).toString("base64")}`;
  const bearerOk = (req) => req.headers.authorization === `Bearer ${FAKE.secretKey}`;
  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let body = "";
    for await (const c of req) body += c;
    const form = new URLSearchParams(body);

    if (url.pathname === "/oauth/authorize") {
      const q = url.searchParams;
      if (q.get("client_id") !== FAKE.clientId || q.get("scope") !== "read_only") return json(res, 400, { error: "invalid_request" });
      const back = new URL(q.get("redirect_uri"));
      back.searchParams.set("code", FAKE.code);
      back.searchParams.set("scope", "read_only");
      back.searchParams.set("state", q.get("state"));
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (url.pathname === "/oauth/token" && req.method === "POST") {
      if (!basicOk(req)) return json(res, 401, { error: "invalid_client" });
      if (form.get("code") !== FAKE.code) return json(res, 400, { error: "invalid_grant" });
      return json(res, 200, { scope: "read_only", stripe_user_id: FAKE.account, livemode: false, access_token: "sk_test_should_be_dropped" });
    }
    if (url.pathname === "/oauth/deauthorize" && req.method === "POST") {
      return basicOk(req) ? json(res, 200, { stripe_user_id: form.get("stripe_user_id") }) : json(res, 401, {});
    }
    if (url.pathname === `/v1/accounts/${FAKE.account}`) {
      return bearerOk(req) ? json(res, 200, { id: FAKE.account, settings: { dashboard: { display_name: "Fake Stripe Co" } } }) : json(res, 401, {});
    }
    if (url.pathname === "/v1/subscriptions") {
      if (!bearerOk(req) || req.headers["stripe-account"] !== FAKE.account) return json(res, 403, { error: { type: "permission_error" } });
      return json(res, 200, { data: [subscription(1, 400), subscription(2, 200), subscription(3, 5)], has_more: false });
    }
    if (url.pathname === "/v1/charges") {
      if (!bearerOk(req) || req.headers["stripe-account"] !== FAKE.account) return json(res, 403, { error: { type: "permission_error" } });
      const now = Math.floor(Date.now() / 1000);
      const gte = Number(url.searchParams.get("created[gte]") ?? 0);
      const lt = Number(url.searchParams.get("created[lt]") ?? now + 1);
      const all = [1, 10, 40].map((days, i) => ({ id: `ch_fake_${i}`, created: now - days * 86400, amount: 25000, amount_refunded: 0, currency: "usd", status: "succeeded", paid: true }));
      return json(res, 200, { data: all.filter((c) => c.created >= gte && c.created < lt), has_more: false });
    }
    json(res, 404, { error: "not found" });
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
