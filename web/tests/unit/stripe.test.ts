import { describe, expect, it } from "vitest";
import fixture from "../fixtures/stripe/subscription-annual-discount.json";
import { normalizeSubscription } from "@/lib/stripe/normalize";
import { checkKeyFormat, RestrictedKeySource, validateRestrictedKey, type FetchLike } from "@/lib/stripe/restricted-key";
import { calculateMetrics } from "@/lib/metrics";
import { sampleBillingData } from "@/lib/stripe/sample";

const KEY = "rk_test_" + "a".repeat(24);

function fakeStripe(handler: (method: string, path: string) => number): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const f: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    calls.push(`${method} ${path}`);
    const status = handler(method, path);
    return new Response(JSON.stringify({ data: [], has_more: false }), { status });
  };
  return { fetch: f, calls };
}

describe("normalizeSubscription", () => {
  it("maps a Stripe subscription, de-duplicating the discount", () => {
    const s = normalizeSubscription(fixture);
    expect(s.customerId).toBe("cus_fixture_1");
    expect(s.items[0]).toMatchObject({ quantity: 2, price: { unitAmount: 120000, interval: "year", usageType: "licensed" } });
    expect(s.discounts).toHaveLength(1);
    expect(s.discounts[0].percentOff).toBe(10);
    const m = calculateMetrics({ subscriptions: [s], sample: false }, { month: "2026-09", now: Date.parse("2026-10-10") / 1000 });
    expect(m.mrr).toBe(18000); // 2 x 1200 / 12 = 200, less 10%
  });

  it("treats pause_collection as paused", () => {
    expect(normalizeSubscription({ ...fixture, pause_collection: { behavior: "void" } }).pauseCollection).toBe(true);
  });
});

describe("key format", () => {
  it("rejects secret and publishable keys", () => {
    expect(checkKeyFormat("sk_live_" + "x".repeat(24))).toMatchObject({ ok: false, error: expect.stringContaining("full write access") });
    expect(checkKeyFormat("pk_test_" + "x".repeat(24))).toMatchObject({ ok: false });
    expect(checkKeyFormat("hello")).toMatchObject({ ok: false });
  });

  it("accepts a restricted key and reports mode and last four", () => {
    expect(checkKeyFormat(`  ${KEY}  `)).toEqual({ ok: true, mode: "test", last4: "aaaa" });
  });
});

describe("validateRestrictedKey", () => {
  it("accepts a read-only key", async () => {
    const s = fakeStripe((m) => (m === "GET" ? 200 : 403));
    expect(await validateRestrictedKey(KEY, s.fetch)).toEqual({ ok: true, mode: "test", last4: "aaaa" });
    expect(s.calls.filter((c) => c.startsWith("GET"))).toHaveLength(5);
    // Write probes only ever target objects that do not exist.
    expect(s.calls.filter((c) => c.startsWith("POST")).every((c) => c.includes("quillmarc_probe"))).toBe(true);
  });

  it("rejects a key that can write", async () => {
    const s = fakeStripe((m, p) => (m === "GET" ? 200 : p.includes("/invoices/") ? 404 : 403));
    const r = await validateRestrictedKey(KEY, s.fetch);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("write to Invoices") });
  });

  it("names a missing read permission", async () => {
    const s = fakeStripe((m, p) => (p === "/v1/charges" ? 403 : m === "GET" ? 200 : 403));
    expect(await validateRestrictedKey(KEY, s.fetch)).toMatchObject({ ok: false, error: expect.stringContaining("cannot read Charges") });
  });

  it("rejects a key Stripe does not know", async () => {
    const s = fakeStripe(() => 401);
    expect(await validateRestrictedKey(KEY, s.fetch)).toMatchObject({ ok: false, error: expect.stringContaining("did not accept") });
  });

  it("never includes the key in an error", async () => {
    const f: FetchLike = async () => {
      throw new Error(`boom ${KEY}`);
    };
    const r = await validateRestrictedKey(KEY, f);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
});

describe("RestrictedKeySource", () => {
  it("pages through every subscription", async () => {
    const pages = [
      { data: [{ ...fixture, id: "sub_a" }], has_more: true },
      { data: [{ ...fixture, id: "sub_b" }], has_more: false },
    ];
    const urls: string[] = [];
    const f: FetchLike = async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(pages[urls.length - 1]), { status: 200 });
    };
    const data = await new RestrictedKeySource(KEY, f).fetchBillingData();
    expect(data.subscriptions.map((s) => s.id)).toEqual(["sub_a", "sub_b"]);
    expect(urls[1]).toContain("starting_after=sub_a");
    expect(urls[0]).toContain("status=all");
  });
});

describe("sample data", () => {
  it("is labeled as sample and produces believable figures", () => {
    const now = Date.parse("2026-10-21") / 1000;
    const d = sampleBillingData(now);
    expect(d.sample).toBe(true);
    const m = calculateMetrics(d, { month: "2026-09", now });
    expect(m.sample).toBe(true);
    expect(m.mrr).toBeGreaterThan(0);
    expect(m.newCustomers).toBeGreaterThan(0);
  });
});
