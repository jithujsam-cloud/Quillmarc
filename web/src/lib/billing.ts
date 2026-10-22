import "server-only";
import { decrypt } from "./crypto";
import { env } from "./env";
import { calculateMetrics, calculatePeriodMetrics, type MetricsResult } from "./metrics";
import { monthPeriod, periodBounds, periodLabel, previousPeriod, type Period } from "./periods";
import { loadDailyRevenue, syncRevenue } from "./revenue";
import type { BillingSource } from "./stripe/adapter";
import { StripeChargeSource, type ChargeSource } from "./stripe/charges";
import { RestrictedKeySource, StripeFetchError } from "./stripe/restricted-key";
import { SampleChargeSource, SampleSource } from "./stripe/sample";
import { ConnectAccountSource } from "./stripe/connect";
import type { BillingData } from "./stripe/types";
import { adminClient } from "./supabase/admin";

export class NotConnectedError extends Error {
  constructor() {
    super("Connect Stripe first.");
    this.name = "NotConnectedError";
  }
}

type Connection = { method: "sample" } | { method: "oauth"; secretKey: string; account: string } | { method: "restricted_key"; key: string };

async function connectionFor(userId: string): Promise<Connection> {
  const { data } = await adminClient().from("stripe_connections").select("method, encrypted_key, stripe_account_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new NotConnectedError();
  if (data.method === "sample") return { method: "sample" };
  if (data.method === "oauth") {
    const connect = env.stripeConnect();
    if (!connect || !data.stripe_account_id) throw new NotConnectedError();
    return { method: "oauth", secretKey: connect.secretKey, account: data.stripe_account_id };
  }
  if (!data.encrypted_key) throw new NotConnectedError();
  return { method: "restricted_key", key: decrypt(data.encrypted_key, env.encryptionKey()) };
}

function billingSource(c: Connection): BillingSource {
  if (c.method === "sample") return new SampleSource();
  if (c.method === "oauth") return new ConnectAccountSource(c.secretKey, c.account);
  return new RestrictedKeySource(c.key);
}

/** Where this founder's payments come from. */
export async function chargeSourceFor(userId: string): Promise<ChargeSource> {
  const c = await connectionFor(userId);
  if (c.method === "sample") return new SampleChargeSource();
  if (c.method === "oauth") return new StripeChargeSource(c.secretKey, "connect", c.account);
  return new StripeChargeSource(c.key, "key");
}

/** Pull subscriptions through the adapter. Nothing from Stripe is stored except what we calculate from it. */
export async function fetchBilling(userId: string): Promise<BillingData> {
  const source = billingSource(await connectionFor(userId));
  const admin = adminClient();
  try {
    const data = await source.fetchBillingData();
    await admin.from("stripe_connections").update({ status: "connected", last_checked_at: new Date().toISOString(), last_error: null }).eq("user_id", userId);
    return data;
  } catch (e) {
    const message = e instanceof StripeFetchError ? e.message : "Could not reach Stripe. Try again in a minute.";
    await admin.from("stripe_connections").update({ status: "error", last_checked_at: new Date().toISOString(), last_error: message }).eq("user_id", userId);
    throw new Error(message);
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** One calendar month. */
export async function computeMetrics(userId: string, month: string): Promise<MetricsResult> {
  const data = await fetchBilling(userId);
  return calculateMetrics(data, { month, now: nowSeconds() });
}

/**
 * The numbers for any period, with the period before it for comparison and the cash collected in it
 * when the payment history covers it. Revenue is best effort: a failure leaves it out.
 */
export async function computePeriodMetrics(userId: string, period: Period): Promise<MetricsResult> {
  const data = await fetchBilling(userId);
  const now = nowSeconds();
  const m = calculatePeriodMetrics(data, { start: period.start, end: period.end, type: period.type, now });

  const prev = previousPeriod(period);
  const pm = calculatePeriodMetrics(data, { start: prev.start, end: prev.end, type: prev.type, now });
  if (pm.currency === m.currency && pm.mrr + pm.customers > 0) {
    m.previous = { label: periodLabel(prev), mrr: pm.mrr, customers: pm.customers, newCustomers: pm.newCustomers, churnedCustomers: pm.churnedCustomers, netNewMrr: pm.netNewMrr };
  }

  try {
    const admin = adminClient();
    await syncRevenue(admin, userId, await chargeSourceFor(userId), { budgetMs: 3000 });
    const { data: sync } = await admin.from("revenue_sync").select("backfill_complete, backfill_before").eq("user_id", userId).maybeSingle();
    const start = periodBounds(period).start;
    const covered = sync && (sync.backfill_complete || (sync.backfill_before && Date.parse(sync.backfill_before) / 1000 <= start));
    if (covered) {
      const rows = (await loadDailyRevenue(admin, userId, period.start, period.end)).filter((r) => r.currency === m.currency);
      m.revenue = {
        gross: rows.reduce((s, r) => s + r.gross, 0),
        refunds: rows.reduce((s, r) => s + r.refunds, 0),
        net: rows.reduce((s, r) => s + r.gross - r.refunds, 0),
        payments: rows.reduce((s, r) => s + r.payments, 0),
      };
    }
  } catch {
    // Revenue is an extra. The update works without it.
  }
  return m;
}

/** The 12 months the dashboard shows, oldest first: "YYYY-MM" keys ending with the running month. */
export function historyMonths(now = new Date()): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const p = monthPeriod(now.getUTCFullYear(), now.getUTCMonth() - (11 - i));
    return p.start.slice(0, 7);
  });
}

const SNAPSHOT_TTL_SECONDS = 300;

/**
 * Keep one saved set of numbers per month. A closed month is calculated once and then left alone;
 * the running month is recalculated when it is more than five minutes old. `force` rebuilds all 12.
 * One read of the subscriptions covers every month that needs it.
 */
export async function ensureSnapshots(userId: string, opts: { force?: boolean } = {}): Promise<void> {
  const admin = adminClient();
  const months = historyMonths();
  if (opts.force) await admin.from("metrics_snapshots").delete().eq("user_id", userId);
  const { data } = await admin.from("metrics_snapshots").select("month, computed_at").eq("user_id", userId);
  const have = new Map((data ?? []).map((r) => [String(r.month).slice(0, 7), Date.parse(r.computed_at) / 1000]));
  const now = nowSeconds();
  const current = months[months.length - 1];
  const todo = months.filter((m) => !have.has(m) || (m === current && now - (have.get(m) as number) > SNAPSHOT_TTL_SECONDS));
  if (!todo.length) return;
  const billing = await fetchBilling(userId);
  const rows = todo.map((m) => ({ user_id: userId, month: `${m}-01`, metrics_json: calculateMetrics(billing, { month: m, now }), computed_at: new Date().toISOString() }));
  const { error } = await admin.from("metrics_snapshots").upsert(rows, { onConflict: "user_id,month" });
  if (error) throw new Error("Could not save the monthly numbers.");
}
