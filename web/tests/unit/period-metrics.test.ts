import { describe, expect, it } from "vitest";
import { calculateMetrics, calculatePeriodMetrics } from "@/lib/metrics";
import { figures } from "@/lib/metrics/present";
import { data, price, sub, t } from "../fixtures/billing";

const now = t("2026-10-22T12:00:00Z");

// Three customers: one from last year, one who joined in August, one who joined in September and left in October.
const subs = () => [
  sub({ customerId: "a", startDate: t("2025-06-01T00:00:00Z"), items: [{ price: price({ unitAmount: 10000 }), quantity: 1 }] }),
  sub({ customerId: "b", startDate: t("2026-08-10T00:00:00Z"), items: [{ price: price({ unitAmount: 20000 }), quantity: 1 }] }),
  sub({ customerId: "c", startDate: t("2026-09-05T00:00:00Z"), endedAt: t("2026-10-05T00:00:00Z"), status: "canceled", items: [{ price: price({ unitAmount: 5000 }), quantity: 1 }] }),
];

describe("a month through the period function", () => {
  it("gives the same numbers as the month function", () => {
    const viaMonth = calculateMetrics(data(subs()), { month: "2026-09", now });
    const viaPeriod = calculatePeriodMetrics(data(subs()), { start: "2026-09-01", end: "2026-09-30", type: "month", now });
    expect(viaPeriod).toMatchObject({
      mrr: viaMonth.mrr,
      previousMrr: viaMonth.previousMrr,
      customers: viaMonth.customers,
      newCustomers: viaMonth.newCustomers,
      churnedCustomers: viaMonth.churnedCustomers,
      growthPercent: viaMonth.growthPercent,
      periodStart: viaMonth.periodStart,
      periodEnd: viaMonth.periodEnd,
    });
  });
});

describe("a quarter", () => {
  const q3 = () => calculatePeriodMetrics(data(subs()), { start: "2026-07-01", end: "2026-09-30", type: "quarter", now });

  it("measures from the start of the quarter to its end", () => {
    const m = q3();
    expect(m.previousMrr).toBe(10000); // only A before July
    expect(m.mrr).toBe(35000); // A, B and C at the end of September
    expect(m.netNewMrr).toBe(25000);
    expect(m.growthPercent).toBe(250);
    expect(m.month).toBe("2026-07");
    expect(m.periodType).toBe("quarter");
    expect(m.monthToDate).toBe(false);
  });

  it("counts customers who joined anywhere in the quarter", () => {
    const m = q3();
    expect(m.customers).toBe(3);
    expect(m.newCustomers).toBe(2); // B in August and C in September
    expect(m.churnedCustomers).toBe(0); // C left in October
    expect(m.startingCustomers).toBe(1);
  });

  it("counts a churn that falls inside a longer period", () => {
    const m = calculatePeriodMetrics(data(subs()), { start: "2026-07-01", end: "2026-10-15", type: "custom", now });
    expect(m.churnedCustomers).toBe(1);
    expect(m.customers).toBe(2);
  });

  it("keeps the retained MRR of the customers who were there at the start", () => {
    const m = q3();
    expect(m.retainedMrr).toBe(10000);
  });
});

describe("a period still running", () => {
  it("stops at now and says so", () => {
    const m = calculatePeriodMetrics(data(subs()), { start: "2026-10-01", end: "2026-12-31", type: "quarter", now });
    expect(m.monthToDate).toBe(true);
    expect(m.periodEnd).toBe(now);
  });
});

describe("labels follow the period", () => {
  it("says quarter where it used to say month", () => {
    const m = calculatePeriodMetrics(data(subs()), { start: "2026-07-01", end: "2026-09-30", type: "quarter", now });
    const f = figures(m);
    expect(f.find((x) => x.key === "previousMrr")?.label).toBe("Last quarter MRR");
    expect(f.find((x) => x.key === "customers")?.note).toContain("end of the quarter");
  });

  it("keeps month wording for a monthly update, and for old rows with no type", () => {
    const m = calculateMetrics(data(subs()), { month: "2026-09", now });
    expect(figures(m).find((x) => x.key === "previousMrr")?.label).toBe("Last month MRR");
    const old = { ...m, periodType: undefined };
    expect(figures(old).find((x) => x.key === "previousMrr")?.label).toBe("Last month MRR");
  });

  it("shows the change against the period before, good or bad by what the figure means", () => {
    const m = calculatePeriodMetrics(data(subs()), { start: "2026-07-01", end: "2026-09-30", type: "quarter", now });
    m.previous = { label: "Q2 2026", mrr: 10000, customers: 1, newCustomers: 1, churnedCustomers: 0, netNewMrr: 0 };
    const f = figures(m);
    const mrr = f.find((x) => x.key === "mrr")?.compare;
    expect(mrr).toMatchObject({ label: "Q2 2026", delta: "+$250", tone: "good" });
    expect(f.find((x) => x.key === "churnedCustomers")?.compare?.tone).toBe("flat");
    m.previous.churnedCustomers = 2;
    expect(figures(m).find((x) => x.key === "churnedCustomers")?.compare).toMatchObject({ delta: "−2", tone: "good" });
  });

  it("adds revenue collected only when it is known", () => {
    const m = calculatePeriodMetrics(data(subs()), { start: "2026-07-01", end: "2026-09-30", type: "quarter", now });
    expect(figures(m).some((f) => f.key === "revenue")).toBe(false);
    m.revenue = { net: 123400, gross: 130000, refunds: 6600, payments: 12 };
    expect(figures(m).find((f) => f.key === "revenue")?.display).toBe("$1,234");
  });
});

describe("a past period never uses what happened later", () => {
  const later = () => [
    sub({ customerId: "early", startDate: t("2026-01-10T00:00:00Z"), items: [{ price: price({ unitAmount: 10000 }), quantity: 1 }] }),
    // Joined after the period ended, and a plan upgrade-sized price: none of it may leak into the past.
    sub({ customerId: "late", startDate: t("2026-10-05T00:00:00Z"), items: [{ price: price({ unitAmount: 90000 }), quantity: 1 }] }),
  ];

  it("leaves out a customer who joined after the period", () => {
    const m = calculatePeriodMetrics(data(later()), { start: "2026-08-01", end: "2026-08-31", type: "month", now });
    expect(m.mrr).toBe(10000);
    expect(m.customers).toBe(1);
    expect(m.newCustomers).toBe(0);
  });

  it("gives the same answer with or without the later customer", () => {
    const withLater = calculatePeriodMetrics(data(later()), { start: "2026-08-01", end: "2026-08-31", type: "month", now });
    const without = calculatePeriodMetrics(data(later().slice(0, 1)), { start: "2026-08-01", end: "2026-08-31", type: "month", now });
    expect(withLater).toEqual(without);
  });

  it("gives the same answer whenever it is asked, as long as the period has finished", () => {
    const first = calculatePeriodMetrics(data(later()), { start: "2026-08-01", end: "2026-08-31", type: "month", now: t("2026-09-02T00:00:00Z") });
    const second = calculatePeriodMetrics(data(later()), { start: "2026-08-01", end: "2026-08-31", type: "month", now: t("2026-10-22T00:00:00Z") });
    expect(second.mrr).toBe(first.mrr);
    expect(second.customers).toBe(first.customers);
  });
});
