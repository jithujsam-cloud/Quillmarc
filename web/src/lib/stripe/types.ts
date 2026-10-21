// Billing data in a shape we own, so the metrics never depend on Stripe's JSON directly.
// All times are Unix seconds (as Stripe sends them). All amounts are in the currency's minor unit.

export type Interval = "day" | "week" | "month" | "year";

export interface NormalizedPrice {
  id: string;
  currency: string;
  unitAmount: number | null;
  interval: Interval;
  intervalCount: number;
  usageType: "licensed" | "metered";
  billingScheme: "per_unit" | "tiered";
}

export interface NormalizedItem {
  price: NormalizedPrice;
  quantity: number;
}

export interface NormalizedDiscount {
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  start: number;
  end: number | null;
}

export interface NormalizedSubscription {
  id: string;
  customerId: string;
  status: string;
  currency: string;
  startDate: number;
  endedAt: number | null;
  trialEnd: number | null;
  pauseCollection: boolean;
  items: NormalizedItem[];
  discounts: NormalizedDiscount[];
}

export interface BillingData {
  subscriptions: NormalizedSubscription[];
  /** True when this is labeled sample data from the demo seed, not a real Stripe account. */
  sample: boolean;
}
