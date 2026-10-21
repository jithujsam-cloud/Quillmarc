import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { as, connect, createUser, hasDb } from "./db";

describe.skipIf(!hasDb)("delete my data", () => {
  let db: pg.Client;
  let user: string;
  let other: string;

  beforeAll(async () => {
    db = await connect();
    user = await createUser(db, `del-${Date.now()}@example.com`);
    other = await createUser(db, `keep-${Date.now()}@example.com`);
    for (const id of [user, other]) {
      await as(db, "service_role", null, async () => {
        await db.query("insert into stripe_connections (user_id, method, encrypted_key) values ($1, 'restricted_key', 'v1:x')", [id]);
        const inv = await db.query("insert into investors (user_id, name, email) values ($1, 'I', 'i@example.com') returning id", [id]);
        const upd = await db.query("insert into updates (user_id, month) values ($1, '2026-08-01') returning id", [id]);
        const send = await db.query(
          "insert into sends (user_id, update_id, investor_id, investor_name, investor_email, token) values ($1, $2, $3, 'I', 'i@example.com', $4) returning id",
          [id, upd.rows[0].id, inv.rows[0].id, id.replace(/-/g, "") + "padpadpad"],
        );
        await db.query("insert into events (user_id, send_id, type, occurred_at, svix_id) values ($1, $2, 'sent', now(), $3)", [id, send.rows[0].id, `msg_${id}`]);
        await db.query("insert into suppressions (user_id, email, reason) values ($1, 'b@example.com', 'bounced')", [id]);
      });
    }
  });

  afterAll(async () => {
    await db.end();
  });

  it("deleting the auth user removes every row for that user and nothing else", async () => {
    // This is what supabase.auth.admin.deleteUser does at the database level.
    await db.query("delete from auth.users where id = $1", [user]);
    const tables = ["profiles", "stripe_connections", "investors", "suppressions", "updates", "sends", "events"];
    for (const t of tables) {
      const col = t === "profiles" ? "id" : "user_id";
      const gone = await db.query(`select count(*)::int as n from ${t} where ${col} = $1`, [user]);
      expect(gone.rows[0].n, t).toBe(0);
      const kept = await db.query(`select count(*)::int as n from ${t} where ${col} = $1`, [other]);
      expect(kept.rows[0].n, t).toBeGreaterThan(0);
    }
  });
});
