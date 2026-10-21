// Fixture builders for billing data. Fictional customers only.
import type { BillingData, NormalizedDiscount, NormalizedPrice, NormalizedSubscription } from "@/lib/stripe/types";

export const t = (iso: string) => Date.parse(iso) / 1000;

let n = 0;
export function price(p: Partial<NormalizedPrice> = {}): NormalizedPrice {
  return { id: `price_${++n}`, currency: "usd", unitAmount: 5000, interval: "month", intervalCount: 1, usageType: "licensed", billingScheme: "per_unit", ...p };
}

export function discount(d: Partial<NormalizedDiscount> & { start: number }): NormalizedDiscount {
  return { percentOff: null, amountOff: null, currency: null, duration: "forever", durationInMonths: null, end: null, ...d };
}

export function sub(s: Partial<NormalizedSubscription> & { customerId?: string } = {}): NormalizedSubscription {
  const id = `sub_${++n}`;
  return {
    id,
    customerId: s.customerId ?? `cus_${id}`,
    status: "active",
    currency: s.items?.[0]?.price.currency ?? "usd",
    startDate: t("2026-01-15T00:00:00Z"),
    endedAt: null,
    trialEnd: null,
    pauseCollection: false,
    items: [{ price: price(), quantity: 1 }],
    discounts: [],
    ...s,
  };
}

export const data = (subscriptions: NormalizedSubscription[], sample = false): BillingData => ({ subscriptions, sample });
