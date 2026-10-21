import type pg from "pg";
import { calculateMetrics } from "@/lib/metrics";
import { sampleBillingData } from "@/lib/stripe/sample";

/** A founder with sender details, three investors and a draft update with metrics. */
export async function seedFounder(db: pg.Client, label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { rows } = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  const userId: string = rows[0].id;
  await db.query("update profiles set founder_name = 'Ada Founder', company_name = 'Northwind', reply_to_email = 'ada@northwind.example' where id = $1", [userId]);
  const investors: string[] = [];
  for (const [name, e] of [["Ivy Chen", "ivy"], ["Omar Diaz", "omar"], ["Lena Park", "lena"]]) {
    const r = await db.query("insert into investors (user_id, name, email) values ($1, $2, $3) returning id", [userId, name, `${e}-${label}@example.com`]);
    investors.push(r.rows[0].id);
  }
  const now = Date.parse("2026-10-05T00:00:00Z") / 1000;
  const metrics = calculateMetrics(sampleBillingData(now), { month: "2026-09", now });
  const u = await db.query(
    "insert into updates (user_id, month, metrics_json, bullets_json) values ($1, '2026-09-01', $2, $3) returning id",
    [userId, metrics, { wins: ["Shipped SSO"], problems: ["Hiring is slow"], asks: ["Intros to fintech CFOs"] }],
  );
  return { userId, email, investors, updateId: u.rows[0].id as string };
}
