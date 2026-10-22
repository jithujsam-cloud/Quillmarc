import { describe, expect, it } from "vitest";
import { arpa, churnRate, mainRevenueCurrency, monthRows, netRetention, percentChange, summarizeRevenue } from "@/lib/analytics";
import { calculatePeriodMetrics } from "@/lib/metrics";
import { aggregateCharges, StripeChargeSource } from "@/lib/stripe/charges";
import { sampleCharges } from "@/lib/stripe/sample";
import { data, sub, t } from "../fixtures/billing";

const at = (iso: string) => t(iso);

describe("daily revenue", () => {
  it("adds charges per UTC day and currency, net of refunds", () => {
    const rows = aggregateCharges([
      { created: at("2026-10-01T23:59:00Z"), amount: 5000, refunded: 0, currency: "usd" },
      { created: at("2026-10-01T01:00:00Z"), amount: 2000, refunded: 500, currency: "usd" },
      { created: at("2026-10-02T00:00:00Z"), amount: 9900, refunded: 0, currency: "usd" },
      { created: at("2026-10-02T10:00:00Z"), amount: 4000, refunded: 0, currency: "eur" },
    ]);
    expect(rows).toEqual([
      { day: "2026-10-01", currency: "usd", gross: 7000, refunds: 500, payments: 2 },
      { day: "2026-10-02", currency: "eur", gross: 4000, refunds: 0, payments: 1 },
      { day: "2026-10-02", currency: "usd", gross: 9900, refunds: 0, payments: 1 },
    ]);
  });

  it("never counts more refunded than was charged", () => {
    expect(aggregateCharges([{ created: at("2026-10-01T00:00:00Z"), amount: 1000, refunded: 5000, currency: "usd" }])[0].refunds).toBe(1000);
  });

  it("picks the currency with the most revenue", () => {
    const rows = aggregateCharges([
      { created: at("2026-10-01T00:00:00Z"), amount: 1000, refunded: 0, currency: "eur" },
      { created: at("2026-10-01T00:00:00Z"), amount: 5000, refunded: 0, currency: "usd" },
    ]);
    expect(mainRevenueCurrency(rows)).toBe("usd");
    expect(mainRevenueCurrency([])).toBeNull();
  });
});

describe("the revenue summary", () => {
  const rows = aggregateCharges([
    { created: at("2026-09-10T10:00:00Z"), amount: 10000, refunded: 0, currency: "usd" }, // before the 22nd of September
    { created: at("2026-09-25T10:00:00Z"), amount: 7000, refunded: 0, currency: "usd" }, // after it
    { created: at("2026-10-05T10:00:00Z"), amount: 20000, refunded: 5000, currency: "usd" },
    { created: at("2026-10-22T08:00:00Z"), amount: 3000, refunded: 0, currency: "usd" },
    { created: at("2025-10-10T08:00:00Z"), amount: 4000, refunded: 0, currency: "usd" },
  ]);
  const s = summarizeRevenue(rows, "usd", "2026-10-22");

  it("gives today, the month so far and the year so far", () => {
    expect(s.today).toBe(3000);
    expect(s.yesterday).toBe(0);
    expect(s.monthToDate).toBe(18000); // 15000 net + 3000
    expect(s.yearToDate).toBe(10000 + 7000 + 15000 + 3000);
  });

  it("compares with the same days of the month before, not all of it", () => {
    expect(s.lastMonthSameDays).toBe(10000);
  });

  it("compares with the same days of last year", () => {
    expect(s.lastYearSameDays).toBe(4000);
  });

  it("has 30 days and 12 months, oldest first, ending today", () => {
    expect(s.days).toHaveLength(30);
    expect(s.days[29]).toEqual({ day: "2026-10-22", net: 3000 });
    expect(s.days[0].day).toBe("2026-09-23");
    expect(s.months).toHaveLength(12);
    expect(s.months[11]).toEqual({ month: "2026-10", net: 18000 });
    expect(s.months[0].month).toBe("2025-11");
    expect(s.months[10]).toEqual({ month: "2026-09", net: 17000 });
  });

  it("prints zeros as zeros when there is nothing", () => {
    const empty = summarizeRevenue([], "usd", "2026-10-22");
    expect(empty.anyRevenue).toBe(false);
    expect(empty.monthToDate).toBe(0);
  });

  it("holds the day number to a short month", () => {
    const r = aggregateCharges([{ created: at("2026-02-28T10:00:00Z"), amount: 100, refunded: 0, currency: "usd" }]);
    expect(summarizeRevenue(r, "usd", "2026-03-31").lastMonthSameDays).toBe(100);
  });
});

describe("percent change", () => {
  it("is null when there was nothing before", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });
});

describe("month by month", () => {
  const now = at("2026-10-22T12:00:00Z");
  const subs = [sub({ customerId: "a", startDate: at("2026-01-01T00:00:00Z") }), sub({ customerId: "b", startDate: at("2026-09-10T00:00:00Z"), endedAt: at("2026-10-10T00:00:00Z"), status: "canceled" })];
  const snap = (month: string) => ({ month, metrics: calculatePeriodMetrics(data(subs), { start: `${month}-01`, end: `${month}-28`, type: "month", now }) });

  it("lists newest first, with growth against the month before", () => {
    const rows = monthRows([snap("2026-08"), snap("2026-09"), snap("2026-10")]);
    expect(rows.map((r) => r.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(rows[1].growth).toBe(100); // 5000 to 10000
  });

  it("measures churn against the customers at the start, and retention against their MRR then", () => {
    const m = snap("2026-10").metrics;
    expect(churnRate(m)).toBe(50);
    expect(netRetention(m)).toBe(50);
    expect(arpa(snap("2026-09").metrics)).toBe(5000);
  });
});

describe("reading charges from Stripe", () => {
  const page = (data: unknown[], more: boolean) => new Response(JSON.stringify({ data, has_more: more }), { status: 200 });
  const charge = (id: string, created: number, extra: Record<string, unknown> = {}) => ({ id, created, amount: 1000, amount_refunded: 0, currency: "USD", status: "succeeded", paid: true, ...extra });

  it("pages through the range and keeps only paid charges", async () => {
    const urls: string[] = [];
    const responses = [page([charge("ch_1", 10), charge("ch_2", 9, { status: "failed", paid: false })], true), page([charge("ch_3", 8, { amount_refunded: 400 })], false)];
    const source = new StripeChargeSource("rk_test_x", "key", undefined, async (url) => {
      urls.push(url);
      return responses.shift() as Response;
    });
    const out = await source.listCharges({ gte: 5, lt: 20 });
    expect(out).toEqual([
      { created: 10, amount: 1000, refunded: 0, currency: "usd" },
      { created: 8, amount: 1000, refunded: 400, currency: "usd" },
    ]);
    expect(urls[0]).toContain("created%5Bgte%5D=5");
    expect(urls[0]).toContain("created%5Blt%5D=20");
    expect(urls[1]).toContain("starting_after=ch_2");
  });

  it("finds the newest charge before a time, skipping failed ones", async () => {
    const source = new StripeChargeSource("rk_test_x", "key", undefined, async () => page([charge("ch_1", 50, { status: "failed", paid: false }), charge("ch_2", 40)], false));
    expect(await source.newestBefore(100)).toBe(40);
    const none = new StripeChargeSource("rk_test_x", "key", undefined, async () => page([], false));
    expect(await none.newestBefore(100)).toBeNull();
  });

  it("does not expose the response when Stripe refuses", async () => {
    const source = new StripeChargeSource("rk_test_x", "key", undefined, async () => new Response("secret body", { status: 403 }));
    await expect(source.listCharges({ gte: 0, lt: 1 })).rejects.toThrow(/missing a read permission/);
  });
});

describe("sample payments", () => {
  it("bill each sample subscription on its interval and stop when it ends", () => {
    const now = at("2026-10-22T12:00:00Z");
    const charges = sampleCharges(now);
    expect(charges.length).toBeGreaterThan(100);
    expect(charges.every((c) => c.created <= now)).toBe(true);
    const rows = aggregateCharges(charges);
    expect(rows.every((r) => r.currency === "usd")).toBe(true);
  });
});
