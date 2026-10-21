import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { as, connect, createUser, hasDb } from "./db";

describe.skipIf(!hasDb)("row level security", () => {
  let db: pg.Client;
  let alice: string;
  let bob: string;
  let aliceUpdate: string;
  let aliceSend: string;

  beforeAll(async () => {
    db = await connect();
    alice = await createUser(db, `alice-${Date.now()}@example.com`);
    bob = await createUser(db, `bob-${Date.now()}@example.com`);
    // Seed Alice's rows as the server would (service role).
    await as(db, "service_role", null, async () => {
      await db.query("insert into stripe_connections (user_id, method, encrypted_key, key_mode, key_last4) values ($1, 'restricted_key', 'v1:secret', 'test', 'abcd')", [alice]);
      const inv = await db.query("insert into investors (user_id, name, email) values ($1, 'Ada Investor', 'ada@example.com') returning id", [alice]);
      const upd = await db.query("insert into updates (user_id, month) values ($1, '2026-09-01') returning id", [alice]);
      aliceUpdate = upd.rows[0].id;
      const send = await db.query(
        "insert into sends (user_id, update_id, investor_id, investor_name, investor_email, token) values ($1, $2, $3, 'Ada', 'ada@example.com', $4) returning id",
        [alice, aliceUpdate, inv.rows[0].id, "t".repeat(43)],
      );
      aliceSend = send.rows[0].id;
      await db.query("insert into events (user_id, send_id, type, occurred_at) values ($1, $2, 'delivered', now())", [alice, aliceSend]);
      await db.query("insert into suppressions (user_id, email, reason) values ($1, 'gone@example.com', 'bounced')", [alice]);
    });
  });

  afterAll(async () => {
    await db.end();
  });

  const tables = ["profiles", "stripe_connections", "investors", "suppressions", "updates", "sends", "events"];

  it("Alice sees her own rows", async () => {
    for (const t of tables) {
      const col = t === "stripe_connections" ? "id" : "*";
      const { rowCount } = await as(db, "authenticated", alice, () => db.query(`select ${col} from ${t}`));
      expect(rowCount, t).toBeGreaterThan(0);
    }
  });

  it("Bob cannot read any of Alice's rows", async () => {
    for (const t of tables) {
      const col = t === "stripe_connections" ? "id" : "*";
      const { rows } = await as(db, "authenticated", bob, () => db.query(`select ${col} from ${t}`));
      const leaked = rows.filter((r) => (r.user_id ?? r.id) === alice);
      expect(leaked, t).toHaveLength(0);
    }
  });

  it("Bob cannot change or delete Alice's rows", async () => {
    const upd = await as(db, "authenticated", bob, () => db.query("update updates set bullets_json = '{}' where id = $1", [aliceUpdate]));
    expect(upd.rowCount).toBe(0);
    const del = await as(db, "authenticated", bob, () => db.query("delete from investors where user_id = $1", [alice]));
    expect(del.rowCount).toBe(0);
  });

  it("Bob cannot insert rows owned by Alice", async () => {
    await expect(
      as(db, "authenticated", bob, () => db.query("insert into investors (user_id, name, email) values ($1, 'X', 'x@example.com')", [alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("nobody can read the encrypted Stripe key from the browser, not even the owner", async () => {
    await expect(as(db, "authenticated", alice, () => db.query("select encrypted_key from stripe_connections"))).rejects.toThrow(/permission denied/);
  });

  it("founders cannot write delivery records or clear an opt-out", async () => {
    await expect(as(db, "authenticated", alice, () => db.query("update sends set status = 'sent'"))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", alice, () => db.query("insert into events (user_id, send_id, type, occurred_at) values ($1, $2, 'read', now())", [alice, aliceSend]))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", alice, () => db.query("update investors set opted_out = false"))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", alice, () => db.query("update updates set test_sent_at = now()"))).rejects.toThrow(/permission denied/);
  });

  it("the anonymous role sees nothing", async () => {
    for (const t of tables) {
      await expect(as(db, "anon", null, () => db.query(`select 1 from ${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });

  it("server-only functions cannot be called from the browser", async () => {
    await expect(as(db, "authenticated", alice, () => db.query("select rate_limit_hit('x', 1, 60)"))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", alice, () => db.query("select * from claim_sends($1, 10, 60)", [aliceUpdate]))).rejects.toThrow(/permission denied/);
  });
});
