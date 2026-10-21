// SAMPLE DATA. Fictional subscriptions for the demo seed account only. Every screen that shows
// figures from this source labels them "Sample data". Never used for a real connection.
import type { BillingSource } from "./adapter";
import type { BillingData, NormalizedSubscription } from "./types";

const DAY = 86400;

function plan(id: string, customerId: string, amount: number, opts: Partial<NormalizedSubscription> & { interval?: "month" | "year"; quantity?: number } = {}): NormalizedSubscription {
  const { interval = "month", quantity = 1, ...rest } = opts;
  return {
    id,
    customerId,
    status: "active",
    currency: "usd",
    startDate: 0,
    endedAt: null,
    trialEnd: null,
    pauseCollection: false,
    items: [{ price: { id: `price_sample_${interval}_${amount}`, currency: "usd", unitAmount: amount, interval, intervalCount: 1, usageType: "licensed", billingScheme: "per_unit" }, quantity }],
    discounts: [],
    ...rest,
  };
}

/** A small fictional company, laid out relative to `now` so recent months always have activity. */
export function sampleBillingData(now: number): BillingData {
  const ago = (days: number) => now - days * DAY;
  const subs: NormalizedSubscription[] = [];
  // 38 steady customers who joined over the past year and a half.
  for (let i = 0; i < 38; i++) {
    const amount = [4900, 9900, 19900][i % 3];
    subs.push(plan(`sub_sample_${i}`, `cus_sample_${i}`, amount, { startDate: ago(540 - i * 12), quantity: i % 7 === 0 ? 3 : 1 }));
  }
  // Annual plans.
  for (let i = 0; i < 6; i++) subs.push(plan(`sub_sample_annual_${i}`, `cus_sample_annual_${i}`, 199000, { interval: "year", startDate: ago(400 - i * 50) }));
  // New customers in each of the last three months.
  for (let i = 0; i < 9; i++) subs.push(plan(`sub_sample_new_${i}`, `cus_sample_new_${i}`, 9900, { startDate: ago(5 + i * 9) }));
  // A handful who cancelled recently.
  for (let i = 0; i < 4; i++) subs.push(plan(`sub_sample_gone_${i}`, `cus_sample_gone_${i}`, 4900, { status: "canceled", startDate: ago(300), endedAt: ago(10 + i * 20) }));
  // One trial, one paused. Both excluded from MRR.
  subs.push(plan("sub_sample_trial", "cus_sample_trial", 9900, { status: "trialing", startDate: ago(3), trialEnd: now + 11 * DAY }));
  subs.push(plan("sub_sample_paused", "cus_sample_paused", 9900, { pauseCollection: true, startDate: ago(200) }));
  // A discounted customer.
  subs.push(plan("sub_sample_discount", "cus_sample_discount", 19900, { startDate: ago(250), discounts: [{ percentOff: 25, amountOff: null, currency: null, duration: "forever", durationInMonths: null, start: ago(250), end: null }] }));
  return { subscriptions: subs, sample: true };
}

export class SampleSource implements BillingSource {
  method = "sample" as const;
  constructor(private readonly now: () => number = () => Math.floor(Date.now() / 1000)) {}
  async fetchBillingData(): Promise<BillingData> {
    return sampleBillingData(this.now());
  }
}
