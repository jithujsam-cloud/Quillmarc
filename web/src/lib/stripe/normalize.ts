// Maps Stripe API objects to our own billing types. Pure. Ignores every field we do not need,
// so nothing else from a Stripe response is kept or stored.
import type { Interval, NormalizedDiscount, NormalizedSubscription } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type StripeObject = Record<string, any>;

const INTERVALS = new Set<Interval>(["day", "week", "month", "year"]);

function id(v: unknown): string {
  return typeof v === "string" ? v : (v as StripeObject | null)?.id ?? "";
}

function normalizeDiscount(d: StripeObject | string | null | undefined): NormalizedDiscount | null {
  if (!d || typeof d === "string") return null;
  // API versions before 2025 put the coupon on the discount. Newer ones nest it under source.
  const c: StripeObject | undefined = d.coupon ?? d.source?.coupon;
  if (!c || typeof c !== "object") return null;
  return {
    percentOff: typeof c.percent_off === "number" ? c.percent_off : null,
    amountOff: typeof c.amount_off === "number" ? c.amount_off : null,
    currency: c.currency ?? null,
    duration: c.duration === "once" || c.duration === "repeating" ? c.duration : "forever",
    durationInMonths: c.duration_in_months ?? null,
    start: typeof d.start === "number" ? d.start : 0,
    end: typeof d.end === "number" ? d.end : null,
  };
}

export function normalizeSubscription(s: StripeObject): NormalizedSubscription {
  const items = ((s.items?.data ?? []) as StripeObject[]).map((item) => {
    const p: StripeObject = item.price ?? {};
    const r: StripeObject = p.recurring ?? {};
    const unit =
      typeof p.unit_amount === "number" ? p.unit_amount : p.unit_amount_decimal != null ? Number(p.unit_amount_decimal) : null;
    return {
      price: {
        id: p.id ?? "",
        currency: String(p.currency ?? s.currency ?? "usd").toLowerCase(),
        unitAmount: Number.isFinite(unit) ? unit : null,
        interval: INTERVALS.has(r.interval) ? (r.interval as Interval) : "month",
        intervalCount: Number(r.interval_count) > 0 ? Number(r.interval_count) : 1,
        usageType: r.usage_type === "metered" ? ("metered" as const) : ("licensed" as const),
        billingScheme: p.billing_scheme === "tiered" ? ("tiered" as const) : ("per_unit" as const),
      },
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
    };
  });

  const discounts: NormalizedDiscount[] = [];
  const seen = new Set<string>();
  for (const d of [...(Array.isArray(s.discounts) ? s.discounts : []), s.discount]) {
    const n = normalizeDiscount(d);
    const key = typeof d === "object" && d ? d.id ?? JSON.stringify(n) : "";
    if (n && !seen.has(key)) {
      seen.add(key);
      discounts.push(n);
    }
  }

  return {
    id: s.id,
    customerId: id(s.customer),
    status: s.status,
    currency: String(s.currency ?? items[0]?.price.currency ?? "usd").toLowerCase(),
    startDate: s.start_date ?? s.created,
    endedAt: s.ended_at ?? null,
    trialEnd: s.trial_end ?? null,
    pauseCollection: Boolean(s.pause_collection),
    items,
    discounts,
  };
}
