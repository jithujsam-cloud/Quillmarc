import { describe, expect, it } from "vitest";
import { calculateMetrics, monthBounds, monthlyAmount } from "@/lib/metrics";
import { figures, formatMoney, parseAdjustment } from "@/lib/metrics/present";
import { data, discount, price, sub, t } from "../fixtures/billing";

const month = "2026-09";
const now = t("2026-10-15T12:00:00Z");
const calc = (subs: Parameters<typeof data>[0]) => calculateMetrics(data(subs), { month, now });

describe("month bounds and normalisation", () => {
  it("uses UTC month boundaries", () => {
    expect(monthBounds("2026-09")).toEqual({ start: t("2026-09-01T00:00:00Z"), end: t("2026-10-01T00:00:00Z") });
    expect(monthBounds("2026-12").end).toBe(t("2027-01-01T00:00:00Z"));
    expect(() => monthBounds("2026-13")).toThrow();
  });

  it("normalises intervals to a month", () => {
    expect(monthlyAmount(120000, "year", 1)).toBe(10000);
    expect(monthlyAmount(1000, "week", 1)).toBeCloseTo((1000 * 52) / 12);
    expect(monthlyAmount(30000, "month", 3)).toBe(10000);
    expect(monthlyAmount(240000, "year", 2)).toBe(10000);
  });
});

describe("MRR", () => {
  it("applies quantity to a monthly plan", () => {
    const m = calc([sub({ items: [{ price: price({ unitAmount: 5000 }), quantity: 3 }] })]);
    expect(m.mrr).toBe(15000);
    expect(m.previousMrr).toBe(15000);
    expect(m.netNewMrr).toBe(0);
    expect(m.growthPercent).toBe(0);
  });

  it("divides annual plans by 12", () => {
    const m = calc([sub({ items: [{ price: price({ unitAmount: 120000, interval: "year" }), quantity: 1 }] })]);
    expect(m.mrr).toBe(10000);
  });

  it("multiplies weekly plans by 52 and divides by 12", () => {
    const m = calc([sub({ items: [{ price: price({ unitAmount: 1000, interval: "week" }), quantity: 1 }] })]);
    expect(m.mrr).toBe(Math.round((1000 * 52) / 12));
  });

  it("applies a forever percent discount", () => {
    const m = calc([sub({ items: [{ price: price({ unitAmount: 10000 }), quantity: 1 }], discounts: [discount({ percentOff: 20, start: t("2026-01-15T00:00:00Z") })] })]);
    expect(m.mrr).toBe(8000);
  });

  it("applies a fixed amount discount only for its duration", () => {
    const s = sub({
      items: [{ price: price({ unitAmount: 5000 }), quantity: 1 }],
      discounts: [discount({ amountOff: 1000, currency: "usd", duration: "repeating", durationInMonths: 1, start: t("2026-09-10T00:00:00Z"), end: t("2026-10-10T00:00:00Z") })],
    });
    const m = calc([s]);
    expect(m.mrr).toBe(4000); // discount still running on Oct 1
    expect(m.previousMrr).toBe(5000); // not yet started on Sep 1
  });

  it("drops a discount after it ends", () => {
    const s = sub({ discounts: [discount({ percentOff: 50, duration: "repeating", durationInMonths: 2, start: t("2026-06-01T00:00:00Z") })] });
    expect(calc([s]).mrr).toBe(5000);
  });

  it("spreads a fixed discount on an annual plan over 12 months", () => {
    const s = sub({
      items: [{ price: price({ unitAmount: 120000, interval: "year" }), quantity: 1 }],
      discounts: [discount({ amountOff: 24000, currency: "usd", start: t("2026-01-15T00:00:00Z") })],
    });
    expect(calc([s]).mrr).toBe(8000);
  });

  it("treats a once discount as one billing interval", () => {
    const s = sub({ discounts: [discount({ percentOff: 50, duration: "once", start: t("2026-09-15T00:00:00Z") })] });
    const m = calc([s]);
    expect(m.mrr).toBe(2500); // Sep 15 to Oct 15 covers Oct 1
    expect(m.previousMrr).toBe(5000);
  });

  it("never goes below zero", () => {
    const s = sub({ discounts: [discount({ amountOff: 999999, currency: "usd", start: t("2026-01-15T00:00:00Z") })] });
    expect(calc([s]).mrr).toBe(0);
  });
});

describe("what is excluded", () => {
  it("excludes subscriptions still in trial", () => {
    const m = calc([sub({ status: "trialing", startDate: t("2026-09-20T00:00:00Z"), trialEnd: t("2026-10-20T00:00:00Z") })]);
    expect(m.mrr).toBe(0);
    expect(m.customers).toBe(0);
    expect(m.newCustomers).toBe(0);
  });

  it("counts a trial from the day it converts", () => {
    const m = calc([sub({ startDate: t("2026-08-20T00:00:00Z"), trialEnd: t("2026-09-03T00:00:00Z") })]);
    expect(m.mrr).toBe(5000);
    expect(m.previousMrr).toBe(0);
    expect(m.newCustomers).toBe(1);
  });

  it("never counts a trial cancelled before it converted", () => {
    const m = calc([sub({ status: "canceled", startDate: t("2026-09-01T00:00:00Z"), trialEnd: t("2026-09-15T00:00:00Z"), endedAt: t("2026-09-10T00:00:00Z") })]);
    expect(m.churnedCustomers).toBe(0);
    expect(m.newCustomers).toBe(0);
  });

  it("excludes paused subscriptions", () => {
    const m = calc([sub({ status: "paused" }), sub({ pauseCollection: true })]);
    expect(m.mrr).toBe(0);
    expect(m.customers).toBe(0);
  });

  it("excludes incomplete subscriptions", () => {
    const m = calc([sub({ status: "incomplete" }), sub({ status: "incomplete_expired" })]);
    expect(m.mrr).toBe(0);
  });

  it("counts a subscription cancelled mid month in last month only, and as churn", () => {
    const m = calc([sub({ status: "canceled", endedAt: t("2026-09-15T00:00:00Z") })]);
    expect(m.mrr).toBe(0);
    expect(m.previousMrr).toBe(5000);
    expect(m.churnedCustomers).toBe(1);
    expect(m.customers).toBe(0);
  });

  it("keeps a subscription set to cancel at period end until it ends", () => {
    expect(calc([sub({ status: "active", endedAt: null })]).mrr).toBe(5000);
  });

  it("excludes metered prices and warns", () => {
    const s = sub({ items: [{ price: price({ unitAmount: 5000 }), quantity: 1 }, { price: price({ unitAmount: 10, usageType: "metered" }), quantity: 1 }] });
    const m = calc([s, sub({ items: [{ price: price({ usageType: "metered" }), quantity: 1 }] })]);
    expect(m.mrr).toBe(5000);
    expect(m.customers).toBe(1);
    expect(m.warnings.map((w) => w.code)).toContain("metered_excluded");
  });

  it("excludes tiered prices without a unit amount and warns", () => {
    const m = calc([sub({ items: [{ price: price({ unitAmount: null, billingScheme: "tiered" }), quantity: 5 }] })]);
    expect(m.mrr).toBe(0);
    expect(m.warnings.map((w) => w.code)).toContain("tiered_excluded");
  });
});

describe("customers", () => {
  it("counts a customer with several subscriptions once", () => {
    const m = calc([sub({ customerId: "cus_a" }), sub({ customerId: "cus_a" }), sub({ customerId: "cus_b" })]);
    expect(m.customers).toBe(2);
    expect(m.mrr).toBe(15000);
  });

  it("does not churn a customer who still has another subscription", () => {
    const m = calc([sub({ customerId: "cus_a", status: "canceled", endedAt: t("2026-09-10T00:00:00Z") }), sub({ customerId: "cus_a" })]);
    expect(m.churnedCustomers).toBe(0);
    expect(m.customers).toBe(1);
  });

  it("does not count a returning customer as new", () => {
    const m = calc([
      sub({ customerId: "cus_a", status: "canceled", startDate: t("2026-03-01T00:00:00Z"), endedAt: t("2026-05-01T00:00:00Z") }),
      sub({ customerId: "cus_a", startDate: t("2026-09-05T00:00:00Z") }),
    ]);
    expect(m.newCustomers).toBe(0);
    expect(m.customers).toBe(1);
  });

  it("counts new customers by their first counted start", () => {
    const m = calc([sub({ startDate: t("2026-09-05T00:00:00Z") }), sub({ startDate: t("2026-08-05T00:00:00Z") })]);
    expect(m.newCustomers).toBe(1);
  });
});

describe("currencies", () => {
  it("counts the main currency only and warns about the rest", () => {
    const eur = price({ currency: "eur", unitAmount: 9000 });
    const m = calc([sub(), sub(), sub({ items: [{ price: eur, quantity: 1 }] })]);
    expect(m.currency).toBe("usd");
    expect(m.mrr).toBe(10000);
    const w = m.warnings.find((x) => x.code === "multi_currency");
    expect(w?.message).toContain("EUR (1 subscription)");
  });

  it("does not warn for one currency", () => {
    expect(calc([sub()]).warnings).toEqual([]);
  });
});

describe("growth and warnings", () => {
  it("computes net new MRR and growth versus last month", () => {
    const m = calc([sub(), sub(), sub(), sub({ startDate: t("2026-09-10T00:00:00Z") })]);
    expect(m.previousMrr).toBe(15000);
    expect(m.mrr).toBe(20000);
    expect(m.netNewMrr).toBe(5000);
    expect(m.growthPercent).toBe(33.3);
    expect(m.previousMrrEstimated).toBe(true);
    expect(m.warnings).toEqual([]);
  });

  it("warns when MRR moves more than 40 percent", () => {
    const m = calc([sub(), sub({ startDate: t("2026-09-10T00:00:00Z") })]);
    expect(m.growthPercent).toBe(100);
    expect(m.warnings.map((w) => w.code)).toContain("large_change");
  });

  it("reports growth as unavailable from zero", () => {
    const m = calc([sub({ startDate: t("2026-09-10T00:00:00Z") })]);
    expect(m.growthPercent).toBeNull();
  });

  it("cuts a running month off at now", () => {
    const m = calculateMetrics(data([sub(), sub({ startDate: t("2026-10-20T00:00:00Z") })]), { month: "2026-10", now });
    expect(m.monthToDate).toBe(true);
    expect(m.periodEnd).toBe(now);
    expect(m.mrr).toBe(5000);
  });

  it("handles an account with no subscriptions", () => {
    const m = calc([]);
    expect(m.mrr).toBe(0);
    expect(m.warnings[0].code).toBe("no_subscriptions");
  });
});

describe("a realistic mixed account", () => {
  it("adds everything up", () => {
    const subs = [
      sub({ customerId: "c1", items: [{ price: price({ unitAmount: 4900 }), quantity: 2 }] }), // 9800
      sub({ customerId: "c2", items: [{ price: price({ unitAmount: 99000, interval: "year" }), quantity: 1 }] }), // 8250
      sub({ customerId: "c3", discounts: [discount({ percentOff: 10, start: t("2026-01-15T00:00:00Z") })] }), // 4500
      sub({ customerId: "c4", status: "trialing", startDate: t("2026-10-01T00:00:00Z"), trialEnd: t("2026-10-30T00:00:00Z") }), // 0
      sub({ customerId: "c5", status: "canceled", endedAt: t("2026-09-20T00:00:00Z") }), // churned, prev 5000
      sub({ customerId: "c6", pauseCollection: true }), // 0
      sub({ customerId: "c7", startDate: t("2026-09-12T00:00:00Z") }), // new 5000
      sub({ customerId: "c8", items: [{ price: price({ currency: "gbp", unitAmount: 5000 }), quantity: 1 }] }), // excluded
      sub({ customerId: "c9", items: [{ price: price({ usageType: "metered" }), quantity: 1 }] }), // excluded
    ];
    const m = calc(subs);
    expect(m.mrr).toBe(9800 + 8250 + 4500 + 5000);
    expect(m.previousMrr).toBe(9800 + 8250 + 4500 + 5000);
    expect(m.customers).toBe(4);
    expect(m.newCustomers).toBe(1);
    expect(m.churnedCustomers).toBe(1);
    expect(m.warnings.map((w) => w.code).sort()).toEqual(["metered_excluded", "multi_currency"]);
  });
});

describe("presentation and adjustments", () => {
  const base = calc([sub(), sub({ startDate: t("2026-09-10T00:00:00Z") })]);

  it("marks edited figures and recalculates the derived ones", () => {
    const f = figures(base, { mrr: 12000 });
    const mrr = f.find((x) => x.key === "mrr")!;
    const net = f.find((x) => x.key === "netNewMrr")!;
    expect(mrr.adjusted).toBe(true);
    expect(net.value).toBe(7000);
    expect(net.adjusted).toBe(true);
    expect(f.find((x) => x.key === "customers")!.adjusted).toBe(false);
  });

  it("parses founder input safely", () => {
    expect(parseAdjustment("mrr", "$12,500", "usd")).toBe(1250000);
    expect(parseAdjustment("mrr", "12500.5", "usd")).toBe(1250050);
    expect(parseAdjustment("mrr", "12500", "jpy")).toBe(12500);
    expect(parseAdjustment("customers", "12.5", "usd")).toBeNull();
    expect(parseAdjustment("customers", "abc", "usd")).toBeNull();
    expect(parseAdjustment("customers", "-3", "usd")).toBeNull();
  });

  it("formats money in major units", () => {
    expect(formatMoney(1250000, "usd")).toBe("$12,500");
    expect(formatMoney(-5000, "usd", { signed: true })).toBe("-$50");
    expect(formatMoney(5000, "usd", { signed: true })).toBe("+$50");
  });
});
