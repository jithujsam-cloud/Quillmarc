import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { adminClient, as, connect, createUser, hasDb } from "./db";
import { syncRevenue } from "@/lib/revenue";
import type { ChargeLite, ChargeSource } from "@/lib/stripe/charges";

describe.skipIf(!hasDb)("update periods and revenue history", () => {
  let db: pg.Client;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await connect();
    alice = await createUser(db, `periods-a-${Date.now()}@example.com`);
    bob = await createUser(db, `periods-b-${Date.now()}@example.com`);
  });
  afterAll(async () => {
    await db.end();
  });

  it("fills the period from a plain monthly insert", async () => {
    const { rows } = await as(db, "service_role", null, () => db.query("insert into updates (user_id, month) values ($1, '2026-02-01') returning period_type, period_start::text, period_end::text", [alice]));
    expect(rows[0]).toEqual({ period_type: "month", period_start: "2026-02-01", period_end: "2026-02-28" });
  });

  it("lets a founder create a quarter and a month that start on the same day", async () => {
    await as(db, "authenticated", alice, async () => {
      await db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'quarter', '2026-07-01', '2026-09-30')", [alice]);
      await db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'month', '2026-07-01', '2026-07-31')", [alice]);
    });
    const { rows } = await db.query("select month::text, period_type from updates where user_id = $1 and period_start = '2026-07-01' order by period_type", [alice]);
    expect(rows).toEqual([
      { month: "2026-07-01", period_type: "month" },
      { month: "2026-07-01", period_type: "quarter" },
    ]);
  });

  it("keeps `month` as the first of the first month, even for a custom range", async () => {
    await as(db, "authenticated", alice, () => db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'custom', '2026-05-17', '2026-06-20')", [alice]));
    const { rows } = await db.query("select month::text from updates where user_id = $1 and period_type = 'custom'", [alice]);
    expect(rows[0].month).toBe("2026-05-01");
  });

  it("refuses the same period twice, a backwards range and a range over 24 months", async () => {
    await expect(as(db, "authenticated", alice, () => db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'quarter', '2026-07-01', '2026-09-30')", [alice]))).rejects.toThrow(/duplicate/);
    await expect(as(db, "authenticated", alice, () => db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'custom', '2026-05-10', '2026-05-01')", [alice]))).rejects.toThrow(/updates_period_order/);
    await expect(as(db, "authenticated", alice, () => db.query("insert into updates (user_id, period_type, period_start, period_end) values ($1, 'custom', '2023-01-01', '2026-01-01')", [alice]))).rejects.toThrow(/updates_period_length/);
  });

  it("does not let the browser set the investor total", async () => {
    await expect(as(db, "authenticated", alice, () => db.query("update updates set investor_total = 99 where user_id = $1", [alice]))).rejects.toThrow(/permission denied/);
  });

  it("keeps revenue and snapshots private and read only", async () => {
    await as(db, "service_role", null, async () => {
      await db.query("insert into revenue_daily (user_id, day, currency, gross, payments) values ($1, '2026-10-01', 'usd', 5000, 1)", [alice]);
      await db.query("insert into metrics_snapshots (user_id, month, metrics_json) values ($1, '2026-09-01', '{}')", [alice]);
      await db.query("insert into revenue_sync (user_id, last_error) values ($1, 'secret')", [alice]).catch(() => undefined);
    });
    for (const t of ["revenue_daily", "metrics_snapshots"]) {
      expect((await as(db, "authenticated", alice, () => db.query(`select * from ${t}`))).rowCount, t).toBe(1);
      expect((await as(db, "authenticated", bob, () => db.query(`select * from ${t}`))).rowCount, t).toBe(0);
    }
    await expect(as(db, "authenticated", alice, () => db.query("insert into revenue_daily (user_id, day, currency, gross) values ($1, '2026-10-02', 'usd', 1)", [alice]))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", alice, () => db.query("update revenue_daily set gross = 1"))).rejects.toThrow(/permission denied/);
    // The sync lock and cursor are server business: the browser may not read them.
    await expect(as(db, "authenticated", alice, () => db.query("select locked_until from revenue_sync"))).rejects.toThrow(/permission denied/);
  });

  it("deleting the account removes the new tables too", async () => {
    const carol = await createUser(db, `periods-c-${Date.now()}@example.com`);
    await as(db, "service_role", null, async () => {
      await db.query("insert into revenue_daily (user_id, day, currency, gross) values ($1, '2026-10-01', 'usd', 1)", [carol]);
      await db.query("insert into revenue_sync (user_id) values ($1)", [carol]);
      await db.query("insert into metrics_snapshots (user_id, month, metrics_json) values ($1, '2026-09-01', '{}')", [carol]);
    });
    await db.query("delete from auth.users where id = $1", [carol]);
    for (const t of ["revenue_daily", "revenue_sync", "metrics_snapshots"]) {
      expect((await db.query(`select 1 from ${t} where user_id = $1`, [carol])).rowCount, t).toBe(0);
    }
  });
});

// A fake Stripe with charges on known days, counting what the sync asks for.
class FakeCharges implements ChargeSource {
  calls: { gte: number; lt: number }[] = [];
  constructor(public charges: ChargeLite[]) {}
  async listCharges(r: { gte: number; lt: number }) {
    this.calls.push(r);
    return this.charges.filter((c) => c.created >= r.gte && c.created < r.lt);
  }
  async newestBefore(lt: number) {
    const older = this.charges.filter((c) => c.created < lt).map((c) => c.created);
    return older.length ? Math.max(...older) : null;
  }
}

describe.skipIf(!hasDb)("the revenue sync", () => {
  let db: pg.Client;
  let user: string;
  const iso = (s: string) => Date.parse(s) / 1000;
  const now = iso("2026-10-22T10:00:00Z");
  const charge = (when: string, amount = 1000): ChargeLite => ({ created: iso(when), amount, refunded: 0, currency: "usd" });

  beforeAll(async () => {
    db = await connect();
    user = await createUser(db, `sync-${Date.now()}@example.com`);
  });
  afterAll(async () => {
    await db.end();
  });

  const saved = async () => (await db.query("select day::text, gross::int, payments from revenue_daily where user_id = $1 order by day", [user])).rows;

  it("imports the recent window, then the older history month by month, skipping empty stretches", async () => {
    const source = new FakeCharges([charge("2026-10-20T09:00:00Z", 3000), charge("2026-10-22T09:00:00Z", 500), charge("2026-06-03T09:00:00Z"), charge("2026-06-20T09:00:00Z"), charge("2025-01-15T09:00:00Z", 7000)]);
    const result = await syncRevenue(adminClient(), user, source, { now });
    expect(result).toMatchObject({ complete: true, synced: true, busy: false, error: null });
    expect((await saved()).map((r) => r.day)).toEqual(["2025-01-15", "2026-06-03", "2026-06-20", "2026-10-20", "2026-10-22"]);
    // The first call covered 35 days, then one call each for June and January 2025: the gap between was never walked.
    expect(source.calls).toHaveLength(3);
  });

  it("does nothing while the data is fresh", async () => {
    const source = new FakeCharges([]);
    const result = await syncRevenue(adminClient(), user, source, { now: now + 120 });
    expect(result).toMatchObject({ complete: true, synced: false });
    expect(source.calls).toHaveLength(0);
  });

  it("later reads only from the start of the day it last ran, so a new payment today shows up", async () => {
    const source = new FakeCharges([charge("2026-10-22T09:00:00Z", 500), charge("2026-10-22T10:30:00Z", 900)]);
    const result = await syncRevenue(adminClient(), user, source, { now: iso("2026-10-22T11:00:00Z") });
    expect(result.synced).toBe(true);
    expect(source.calls).toHaveLength(1);
    expect(source.calls[0].gte).toBe(iso("2026-10-22T00:00:00Z"));
    const today = (await saved()).find((r) => r.day === "2026-10-22");
    expect(today).toEqual({ day: "2026-10-22", gross: 1400, payments: 2 });
  });

  it("re-reads the last 35 days once a day, so refunds on older charges are picked up", async () => {
    const source = new FakeCharges([{ ...charge("2026-10-20T09:00:00Z", 3000), refunded: 1000 }]);
    await syncRevenue(adminClient(), user, source, { now: iso("2026-10-23T11:00:00Z") });
    expect(source.calls[0].gte).toBe(iso("2026-09-18T00:00:00Z"));
    const { rows } = await db.query("select gross::int, refunds::int from revenue_daily where user_id = $1 and day = '2026-10-20'", [user]);
    expect(rows[0]).toEqual({ gross: 3000, refunds: 1000 });
  });

  it("does not run twice at once", async () => {
    const other = await createUser(db, `sync-lock-${Date.now()}@example.com`);
    await db.query("insert into revenue_sync (user_id, locked_until) values ($1, now() + interval '30 seconds')", [other]);
    const source = new FakeCharges([]);
    const result = await syncRevenue(adminClient(), other, source, { force: true, now: Math.floor(Date.now() / 1000) });
    expect(result.busy).toBe(true);
    expect(source.calls).toHaveLength(0);
  });

  it("records an error and lets go of the lock, so the next call can try again", async () => {
    const failing: ChargeSource = {
      async listCharges() {
        throw new Error("Stripe returned an error. Try again in a minute.");
      },
      async newestBefore() {
        return null;
      },
    };
    const other = await createUser(db, `sync-fail-${Date.now()}@example.com`);
    const result = await syncRevenue(adminClient(), other, failing, { now });
    expect(result.error).toMatch(/Try again/);
    const { rows } = await db.query("select locked_until, last_error, backfill_complete from revenue_sync where user_id = $1", [other]);
    expect(rows[0]).toMatchObject({ locked_until: null, backfill_complete: false });
    expect(rows[0].last_error).toMatch(/Try again/);
  });
});
