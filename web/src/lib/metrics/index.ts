// Metric calculation. Pure functions only: no network, no clock, no database.
// Definitions live in METRICS.md. Keep the two in step.
import type { BillingData, Interval, NormalizedDiscount, NormalizedSubscription } from "../stripe/types";

export type WarningCode = "multi_currency" | "metered_excluded" | "tiered_excluded" | "large_change" | "no_subscriptions";

export interface MetricWarning {
  code: WarningCode;
  message: string;
}

export interface MetricsResult {
  /** "YYYY-MM" */
  month: string;
  currency: string;
  /** Unix seconds. The month's first instant (UTC). */
  periodStart: number;
  /** Unix seconds. The month's end, or "now" when the month is still running. */
  periodEnd: number;
  monthToDate: boolean;
  mrr: number;
  previousMrr: number;
  previousMrrEstimated: true;
  netNewMrr: number;
  growthPercent: number | null;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  subscriptionsCounted: number;
  warnings: MetricWarning[];
  sample: boolean;
}

/** Statuses that never count, whatever their dates say. */
const NEVER_COUNTED = new Set(["incomplete", "incomplete_expired", "paused", "unpaid"]);
export const LARGE_CHANGE_PERCENT = 40;

export function monthBounds(month: string): { start: number; end: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Invalid month: ${month}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) throw new Error(`Invalid month: ${month}`);
  return { start: Date.UTC(y, mo, 1) / 1000, end: Date.UTC(y, mo + 1, 1) / 1000 };
}

/** Length of one billing interval, in months. */
export function intervalMonths(interval: Interval, count: number): number {
  switch (interval) {
    case "month":
      return count;
    case "year":
      return 12 * count;
    case "week":
      return (count * 12) / 52;
    case "day":
      return (count * 12) / 365;
  }
}

/** A recurring amount per interval, expressed per month. Annual / 12, weekly * 52 / 12. */
export function monthlyAmount(amount: number, interval: Interval, count: number): number {
  return amount / intervalMonths(interval, count);
}

function addMonths(unix: number, months: number): number {
  const d = new Date(unix * 1000);
  const whole = Math.floor(months);
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + whole, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  // Fractional months (weekly and daily plans) are added as days.
  return r.getTime() / 1000 + Math.round((months - whole) * 30.4375 * 86400);
}

/** When the subscription first counts: its start, or the end of its trial. */
export function countedStart(sub: NormalizedSubscription): number {
  return sub.trialEnd && sub.trialEnd > sub.startDate ? sub.trialEnd : sub.startDate;
}

/** Was the subscription ever counted? A trial that was cancelled before it ended never was. */
function everCounted(sub: NormalizedSubscription): boolean {
  if (NEVER_COUNTED.has(sub.status) || sub.pauseCollection) return false;
  if (!sub.items.some((i) => isCountableItem(i.price))) return false;
  return sub.endedAt === null || sub.endedAt > countedStart(sub);
}

function isCountableItem(price: NormalizedSubscription["items"][number]["price"]): boolean {
  return price.usageType === "licensed" && price.unitAmount !== null;
}

/** Counted at the end of a period that finishes at instant t. */
export function isCountedAt(sub: NormalizedSubscription, t: number): boolean {
  if (!everCounted(sub)) return false;
  return countedStart(sub) < t && (sub.endedAt === null || sub.endedAt >= t);
}

function discountEnd(d: NormalizedDiscount, sub: NormalizedSubscription): number | null {
  if (d.duration === "forever") return null;
  if (d.duration === "repeating") return d.end ?? addMonths(d.start, d.durationInMonths ?? 0);
  // "once" applies to one invoice: treat it as one billing interval long.
  const first = sub.items[0]?.price;
  return addMonths(d.start, first ? intervalMonths(first.interval, first.intervalCount) : 1);
}

/** Monthly recurring revenue of one subscription at instant t, discounts applied. */
export function subscriptionMrrAt(sub: NormalizedSubscription, t: number): number {
  if (!isCountedAt(sub, t)) return 0;
  let total = 0;
  for (const item of sub.items) {
    if (!isCountableItem(item.price)) continue;
    total += monthlyAmount((item.price.unitAmount as number) * item.quantity, item.price.interval, item.price.intervalCount);
  }
  const active = sub.discounts.filter((d) => {
    const end = discountEnd(d, sub);
    return d.start < t && (end === null || t <= end);
  });
  // Percent discounts first, then fixed amounts. A fixed amount is per invoice, so spread it per month.
  for (const d of active) if (d.percentOff) total *= 1 - d.percentOff / 100;
  const billing = sub.items.find((i) => isCountableItem(i.price))?.price;
  for (const d of active) {
    if (!d.amountOff || !billing) continue;
    if (d.currency && d.currency !== sub.currency) continue;
    total -= d.amountOff / intervalMonths(billing.interval, billing.intervalCount);
  }
  return Math.max(0, total);
}

/** Pick the currency with the most subscriptions that count in this month. Ties go to the alphabetically first. */
export function mainCurrency(subs: NormalizedSubscription[], start: number, end: number): string | null {
  const counts = new Map<string, number>();
  const relevant = subs.filter((s) => isCountedAt(s, end) || isCountedAt(s, start));
  for (const s of relevant.length ? relevant : subs) counts.set(s.currency, (counts.get(s.currency) ?? 0) + 1);
  let best: string | null = null;
  for (const [cur, n] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (best === null || n > (counts.get(best) ?? 0)) best = cur;
  }
  return best;
}

export interface CalculateOptions {
  month: string;
  /** Unix seconds. Used only to cut off a month that is still running. */
  now: number;
}

export function calculateMetrics(data: BillingData, { month, now }: CalculateOptions): MetricsResult {
  const bounds = monthBounds(month);
  const monthToDate = now < bounds.end;
  const periodStart = bounds.start;
  const periodEnd = monthToDate ? now : bounds.end;
  const warnings: MetricWarning[] = [];

  const currency = mainCurrency(data.subscriptions, periodStart, periodEnd);
  if (!currency) {
    return {
      month, currency: "usd", periodStart, periodEnd, monthToDate,
      mrr: 0, previousMrr: 0, previousMrrEstimated: true, netNewMrr: 0, growthPercent: null,
      customers: 0, newCustomers: 0, churnedCustomers: 0, subscriptionsCounted: 0,
      warnings: [{ code: "no_subscriptions", message: "No subscriptions were found in this Stripe account." }],
      sample: data.sample,
    };
  }

  const others = new Map<string, number>();
  for (const s of data.subscriptions) {
    if (s.currency !== currency && (isCountedAt(s, periodEnd) || isCountedAt(s, periodStart))) {
      others.set(s.currency, (others.get(s.currency) ?? 0) + 1);
    }
  }
  if (others.size) {
    const list = [...others.entries()].map(([c, n]) => `${c.toUpperCase()} (${n} ${n === 1 ? "subscription" : "subscriptions"})`).join(", ");
    warnings.push({
      code: "multi_currency",
      message: `Only ${currency.toUpperCase()} is counted. Other currencies were excluded: ${list}.`,
    });
  }

  const subs = data.subscriptions.filter((s) => s.currency === currency);

  // Usage-based and tiered prices cannot be turned into a fixed monthly amount from the price alone.
  const live = subs.filter((s) => !NEVER_COUNTED.has(s.status) && !s.pauseCollection && (s.endedAt === null || s.endedAt >= periodStart));
  const metered = live.filter((s) => s.items.some((i) => i.price.usageType === "metered")).length;
  const tiered = live.filter((s) => s.items.some((i) => i.price.usageType === "licensed" && i.price.unitAmount === null)).length;
  if (metered) {
    warnings.push({
      code: "metered_excluded",
      message: `${metered} ${metered === 1 ? "subscription has" : "subscriptions have"} usage-based prices. Those prices are excluded from MRR.`,
    });
  }
  if (tiered) {
    warnings.push({
      code: "tiered_excluded",
      message: `${tiered} ${tiered === 1 ? "subscription has" : "subscriptions have"} tiered prices with no unit amount. Those prices are excluded from MRR.`,
    });
  }

  const mrr = subs.reduce((sum, s) => sum + subscriptionMrrAt(s, periodEnd), 0);
  const previousMrr = subs.reduce((sum, s) => sum + subscriptionMrrAt(s, periodStart), 0);

  const byCustomer = new Map<string, NormalizedSubscription[]>();
  for (const s of subs) {
    if (!everCounted(s)) continue;
    byCustomer.set(s.customerId, [...(byCustomer.get(s.customerId) ?? []), s]);
  }

  let customers = 0;
  let newCustomers = 0;
  let churnedCustomers = 0;
  for (const list of byCustomer.values()) {
    if (list.some((s) => isCountedAt(s, periodEnd))) customers++;
    const first = Math.min(...list.map(countedStart));
    if (first >= periodStart && first < periodEnd) newCustomers++;
    if (list.every((s) => s.endedAt !== null)) {
      const last = Math.max(...list.map((s) => s.endedAt as number));
      if (last >= periodStart && last < periodEnd) churnedCustomers++;
    }
  }

  const roundedMrr = Math.round(mrr);
  const roundedPrev = Math.round(previousMrr);
  const netNewMrr = roundedMrr - roundedPrev;
  const growthPercent = roundedPrev > 0 ? Math.round((netNewMrr / roundedPrev) * 1000) / 10 : null;
  if (growthPercent !== null && Math.abs(growthPercent) > LARGE_CHANGE_PERCENT) {
    warnings.push({
      code: "large_change",
      message: `MRR changed by ${Math.abs(growthPercent)} percent versus last month. Check the numbers before you send.`,
    });
  }

  return {
    month,
    currency,
    periodStart,
    periodEnd,
    monthToDate,
    mrr: roundedMrr,
    previousMrr: roundedPrev,
    previousMrrEstimated: true,
    netNewMrr,
    growthPercent,
    customers,
    newCustomers,
    churnedCustomers,
    subscriptionsCounted: subs.filter((s) => isCountedAt(s, periodEnd)).length,
    warnings,
    sample: data.sample,
  };
}
