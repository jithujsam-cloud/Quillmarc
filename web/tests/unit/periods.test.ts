import { describe, expect, it } from "vitest";
import {
  defaultPeriod,
  overlaps,
  periodBounds,
  periodChoices,
  periodLabel,
  periodRange,
  previousPeriod,
  quarterPeriod,
  validatePeriod,
  yearPeriod,
  monthPeriod,
  type Period,
} from "@/lib/periods";

const now = new Date("2026-10-22T09:00:00Z");

describe("period labels", () => {
  it("names each kind the way an investor reads it", () => {
    expect(periodLabel(monthPeriod(2026, 6))).toBe("July 2026");
    expect(periodLabel(quarterPeriod(2026, 3))).toBe("Q3 2026");
    expect(periodLabel(yearPeriod(2026))).toBe("2026");
    expect(periodLabel({ type: "custom", start: "2026-07-01", end: "2026-08-15" })).toBe("1 Jul to 15 Aug 2026");
  });

  it("writes the dates in full and drops what repeats", () => {
    expect(periodRange(quarterPeriod(2026, 3))).toBe("1 Jul to 30 Sep 2026");
    expect(periodRange({ type: "custom", start: "2026-10-03", end: "2026-10-20" })).toBe("3 to 20 Oct 2026");
    expect(periodRange({ type: "custom", start: "2025-11-03", end: "2026-01-20" })).toBe("3 Nov 2025 to 20 Jan 2026");
    expect(periodRange({ type: "custom", start: "2026-10-03", end: "2026-10-03" })).toBe("3 Oct 2026");
  });
});

describe("period bounds", () => {
  it("runs from the first instant of the first day to the first instant after the last", () => {
    const b = periodBounds(quarterPeriod(2026, 3));
    expect(b.start).toBe(Date.parse("2026-07-01T00:00:00Z") / 1000);
    expect(b.end).toBe(Date.parse("2026-10-01T00:00:00Z") / 1000);
  });

  it("handles leap years", () => {
    expect(monthPeriod(2028, 1).end).toBe("2028-02-29");
    expect(monthPeriod(2026, 1).end).toBe("2026-02-28");
  });
});

describe("the choices", () => {
  it("lists 12 months, 8 quarters and 4 years, the running one first", () => {
    const months = periodChoices("month", now);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ start: "2026-10-01", end: "2026-10-31" });
    expect(months[11]).toMatchObject({ start: "2025-11-01" });
    const quarters = periodChoices("quarter", now);
    expect(quarters).toHaveLength(8);
    expect(quarters[0]).toMatchObject({ start: "2026-10-01", end: "2026-12-31" });
    expect(quarters[1]).toMatchObject({ start: "2026-07-01", end: "2026-09-30" });
    expect(quarters[4]).toMatchObject({ start: "2025-10-01" });
    expect(periodChoices("year", now).map((p) => p.start)).toEqual(["2026-01-01", "2025-01-01", "2024-01-01", "2023-01-01"]);
  });

  it("walks back across the new year", () => {
    const q = periodChoices("quarter", new Date("2026-02-10T00:00:00Z"));
    expect(q.slice(0, 2).map((p) => p.start)).toEqual(["2026-01-01", "2025-10-01"]);
    const m = periodChoices("month", new Date("2026-01-10T00:00:00Z"));
    expect(m[1].start).toBe("2025-12-01");
  });

  it("suggests the last finished period", () => {
    expect(defaultPeriod("month", now).start).toBe("2026-09-01");
    expect(defaultPeriod("quarter", now).start).toBe("2026-07-01");
    expect(defaultPeriod("year", now).start).toBe("2025-01-01");
  });
});

describe("the period before", () => {
  it("steps back by the same kind", () => {
    expect(previousPeriod(monthPeriod(2026, 0))).toMatchObject({ start: "2025-12-01", end: "2025-12-31" });
    expect(previousPeriod(quarterPeriod(2026, 1))).toMatchObject({ start: "2025-10-01", end: "2025-12-31" });
    expect(previousPeriod(quarterPeriod(2026, 3))).toMatchObject({ start: "2026-04-01", end: "2026-06-30" });
    expect(previousPeriod(yearPeriod(2026))).toMatchObject({ start: "2025-01-01", end: "2025-12-31" });
  });

  it("gives a custom range the same length, ending the day before", () => {
    const p = previousPeriod({ type: "custom", start: "2026-07-01", end: "2026-07-10" });
    expect(p).toEqual({ type: "custom", start: "2026-06-21", end: "2026-06-30" });
  });
});

describe("validation", () => {
  const custom = (start: string, end: string): Period => ({ type: "custom", start, end });

  it("accepts a listed period and a sensible custom range", () => {
    expect(validatePeriod(quarterPeriod(2026, 3), now)).toBeNull();
    expect(validatePeriod(custom("2026-08-01", "2026-10-22"), now)).toBeNull();
  });

  it("explains what is wrong in plain words", () => {
    expect(validatePeriod(custom("2026-08-10", "2026-08-01"), now)).toMatch(/before the start/);
    expect(validatePeriod(custom("2026-08-01", "2026-12-01"), now)).toMatch(/future/);
    expect(validatePeriod(custom("2026-11-01", "2026-11-05"), now)).toMatch(/not started/);
    expect(validatePeriod(custom("2024-01-01", "2026-10-01"), now)).toMatch(/24 months/);
    expect(validatePeriod(custom("2026-02-31", "2026-03-05"), now)).toMatch(/both dates/);
    expect(validatePeriod(quarterPeriod(2019, 1), now)).toMatch(/from the list/);
  });

  it("allows exactly 24 months", () => {
    expect(validatePeriod(custom("2024-10-23", "2026-10-22"), now)).toBeNull();
  });
});

describe("overlap", () => {
  it("is true when the ranges share a day", () => {
    expect(overlaps(quarterPeriod(2026, 3), monthPeriod(2026, 6))).toBe(true);
    expect(overlaps(quarterPeriod(2026, 3), monthPeriod(2026, 9))).toBe(false);
    expect(overlaps(monthPeriod(2026, 8), monthPeriod(2026, 9))).toBe(false);
  });
});
