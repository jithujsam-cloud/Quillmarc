import "server-only";
import { decrypt } from "./crypto";
import { env } from "./env";
import { calculateMetrics, type MetricsResult } from "./metrics";
import type { BillingSource } from "./stripe/adapter";
import { RestrictedKeySource, StripeFetchError } from "./stripe/restricted-key";
import { SampleSource } from "./stripe/sample";
import { ConnectAccountSource } from "./stripe/connect";
import { adminClient } from "./supabase/admin";

export class NotConnectedError extends Error {
  constructor() {
    super("Connect Stripe first.");
    this.name = "NotConnectedError";
  }
}

async function billingSourceFor(userId: string): Promise<BillingSource> {
  const { data } = await adminClient().from("stripe_connections").select("method, encrypted_key, stripe_account_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new NotConnectedError();
  if (data.method === "sample") return new SampleSource();
  if (data.method === "oauth") {
    const connect = env.stripeConnect();
    if (!connect || !data.stripe_account_id) throw new NotConnectedError();
    return new ConnectAccountSource(connect.secretKey, data.stripe_account_id);
  }
  if (!data.encrypted_key) throw new NotConnectedError();
  return new RestrictedKeySource(decrypt(data.encrypted_key, env.encryptionKey()));
}

/** Pull subscriptions through the adapter and calculate. Nothing from Stripe is stored except the result. */
export async function computeMetrics(userId: string, month: string): Promise<MetricsResult> {
  const source = await billingSourceFor(userId);
  const admin = adminClient();
  try {
    const data = await source.fetchBillingData();
    await admin.from("stripe_connections").update({ status: "connected", last_checked_at: new Date().toISOString(), last_error: null }).eq("user_id", userId);
    return calculateMetrics(data, { month, now: Math.floor(Date.now() / 1000) });
  } catch (e) {
    const message = e instanceof StripeFetchError ? e.message : "Could not reach Stripe. Try again in a minute.";
    await admin.from("stripe_connections").update({ status: "error", last_checked_at: new Date().toISOString(), last_error: message }).eq("user_id", userId);
    throw new Error(message);
  }
}
