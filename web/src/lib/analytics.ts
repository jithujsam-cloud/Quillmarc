// What the founder dashboard shows, worked out from saved rows. Pure: no clock, no database.
import type { MetricsResult } from "./metrics";
import { addDays } from "./periods";
import { netOf, type DailyRow } from "./stripe/charges";

export interface RevenueSummary {
  currency: string;
  today: number;
  yesterday: number;
  /** This month so far, and the same days of last month, for a fair comparison. */
  monthToDate: number;
  lastMonthSameDays: number;
  yearToDate: number;
  lastYearSameDays: number;
  /** The last 30 days, oldest first. */
  days: { day: string; net: number }[];
  /** The last 12 months, oldest first. */
  months: { month: string; net: number }[];
  anyRevenue: boolean;
}

/** Net revenue of one currency from `from` to `to`, inclusive. */
export function sumNet(rows: DailyRow[], currency: string, from: string, to: string): number {
  let total = 0;
  for (const r of rows) if (r.currency === currency && r.day >= from && r.day <= to) total += netOf(r);
  return total;
}

/** The currency with the most revenue in the rows; ties go to the alphabetically first. */
export function mainRevenueCurrency(rows: DailyRow[]): string | null {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + netOf(r));
  let best: string | null = null;
  for (const [c, n] of [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))) if (best === null || n > (totals.get(best) ?? 0)) best = c;
  return best;
}

function monthStart(day: string) {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonths(day: string, delta: number): string {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`; // taste-skill-ignore: ISO date key, not a label
}

/** Same day number in another month, held to that month's last day (31 Mar becomes 28 Feb). */
function sameDayIn(monthFirst: string, dayOfMonth: number): string {
  const [y, m] = monthFirst.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthFirst.slice(0, 8)}${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}

export function summarizeRevenue(rows: DailyRow[], currency: string, today: string): RevenueSummary {
  const dayOfMonth = Number(today.slice(8, 10));
  const thisMonth = monthStart(today);
  const lastMonth = shiftMonths(thisMonth, -1);
  const year = today.slice(0, 4);
  const lastYearToday = `${Number(year) - 1}${today.slice(4)}`;

  const days = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    return { day, net: sumNet(rows, currency, day, day) };
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const first = shiftMonths(thisMonth, i - 11);
    const last = i === 11 ? today : addDays(shiftMonths(first, 1), -1);
    return { month: first.slice(0, 7), net: sumNet(rows, currency, first, last) };
  });

  return {
    currency,
    today: sumNet(rows, currency, today, today),
    yesterday: sumNet(rows, currency, addDays(today, -1), addDays(today, -1)),
    monthToDate: sumNet(rows, currency, thisMonth, today),
    lastMonthSameDays: sumNet(rows, currency, lastMonth, sameDayIn(lastMonth, dayOfMonth)),
    yearToDate: sumNet(rows, currency, `${year}-01-01`, today),
    lastYearSameDays: sumNet(rows, currency, `${Number(year) - 1}-01-01`, lastYearToday),
    days,
    months,
    anyRevenue: rows.some((r) => r.currency === currency && netOf(r) > 0),
  };
}

/** A change as a percent with one decimal. Null when the earlier value is zero. */
export function percentChange(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null;
}

export interface MonthRow {
  /** "YYYY-MM" */
  month: string;
  metrics: MetricsResult;
  growth: number | null;
}

/** Monthly numbers, newest first, with growth against the month before shown in the same table. */
export function monthRows(snapshots: { month: string; metrics: MetricsResult }[]): MonthRow[] {
  const asc = [...snapshots].sort((a, b) => (a.month < b.month ? -1 : 1));
  return asc.map((s, i) => ({ month: s.month, metrics: s.metrics, growth: i > 0 ? percentChange(s.metrics.mrr, asc[i - 1].metrics.mrr) : s.metrics.growthPercent })).reverse();
}

/** Customers lost in a month as a share of those at its start. Null when there were none to lose. */
export function churnRate(m: MetricsResult): number | null {
  const start = m.startingCustomers ?? Math.max(0, m.customers - m.newCustomers + m.churnedCustomers);
  return start > 0 ? Math.round((m.churnedCustomers / start) * 1000) / 10 : null;
}

/** Net revenue retention over the period: what today's MRR from last period's customers is, against their MRR then. */
export function netRetention(m: MetricsResult): number | null {
  if (m.retainedMrr === undefined || m.previousMrr <= 0) return null;
  return Math.round((m.retainedMrr / m.previousMrr) * 1000) / 10;
}

/** Average revenue per customer per month, in minor units. */
export function arpa(m: MetricsResult): number | null {
  return m.customers > 0 ? Math.round(m.mrr / m.customers) : null;
}

