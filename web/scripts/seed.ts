// Demo seed. Creates one founder account with SAMPLE data: a sample Stripe connection
// (fictional subscriptions, labeled "Sample data" on every screen), fictional investors on
// example.com, and one sent update from two months ago with sample delivery events.
//
// Usage:  SEED_USER_EMAIL=you@yourdomain.com npm run seed
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Safe to run twice: it reuses the user and skips what already exists.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { calculateMetrics } from "../src/lib/metrics";
import { sampleBillingData } from "../src/lib/stripe/sample";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.SEED_USER_EMAIL ?? "demo@example.com").toLowerCase();
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const INVESTORS = [
  ["Riley Moss", "riley.moss"],
  ["Jordan Okafor", "jordan.okafor"],
  ["Sam Lindqvist", "sam.lindqvist"],
  ["Priya Raman", "priya.raman"],
  ["Theo Marchetti", "theo.marchetti"],
  ["Alex Kim", "alex.kim"],
];

function monthOffset(n: number): string {
  const d = new Date();
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function findOrCreateUser(): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  // Already exists: find it.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Could not create or find ${email}: ${created.error?.message}`);
}

async function main() {
  const userId = await findOrCreateUser();
  await admin.from("profiles").upsert({ id: userId, email, founder_name: "Morgan Ellis", company_name: "Ledgerlane (sample)", reply_to_email: email });
  await admin.from("stripe_connections").upsert({ user_id: userId, method: "sample", status: "connected", last_checked_at: new Date().toISOString() }, { onConflict: "user_id" });

  const { data: existing } = await admin.from("investors").select("id, email").eq("user_id", userId);
  const have = new Set((existing ?? []).map((i) => i.email));
  const fresh = INVESTORS.filter(([, e]) => !have.has(`${e}@example.com`)).map(([name, e]) => ({ user_id: userId, name, email: `${e}@example.com` }));
  if (fresh.length) await admin.from("investors").insert(fresh);
  const { data: investors } = await admin.from("investors").select("id, name, email").eq("user_id", userId).order("name");

  // One earlier update, already sent, with sample delivery events.
  const month = monthOffset(2);
  const { data: prior } = await admin.from("updates").select("id").eq("user_id", userId).eq("month", `${month}-01`).maybeSingle();
  if (!prior) {
    const endOfMonth = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1) / 1000;
    const metrics = calculateMetrics(sampleBillingData(endOfMonth + 3 * 86400), { month, now: endOfMonth + 3 * 86400 });
    const sentAt = new Date((endOfMonth + 3 * 86400) * 1000);
    const { data: update, error } = await admin
      .from("updates")
      .insert({
        user_id: userId,
        month: `${month}-01`,
        status: "sent",
        metrics_json: metrics,
        bullets_json: { wins: ["Signed two annual plans (sample)"], problems: ["Onboarding takes too long (sample)"], asks: ["Intros to finance leads at Series A startups (sample)"] },
        test_sent_at: sentAt.toISOString(),
        sent_at: sentAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    const at = (s: number) => new Date(sentAt.getTime() + s * 1000).toISOString();
    for (const [i, inv] of (investors ?? []).entries()) {
      const { data: send } = await admin
        .from("sends")
        .insert({
          user_id: userId,
          update_id: update.id,
          investor_id: inv.id,
          investor_name: inv.name,
          investor_email: inv.email,
          token: randomBytes(32).toString("base64url"),
          resend_message_id: `sample_${update.id}_${i}`,
          status: "sent",
          attempts: 1,
          sent_at: at(0),
        })
        .select("id")
        .single();
      if (!send) continue;
      const events: [string, number][] = [["sent", 1], ["delivered", 3]];
      if (i % 3 === 0) events.push(["opened", 5]);
      if (i % 3 === 1) events.push(["opened", 3600], ["read", 3700]);
      await admin.from("events").insert(events.map(([type, s]) => ({ user_id: userId, send_id: send.id, type, occurred_at: at(s), raw: { sample: true } })));
    }
  }
  console.log(`Seeded ${email} (user ${userId}). Sign in with a magic link to that address.`);
  return userId;
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
