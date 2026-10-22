import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { as, connect, createUser, hasDb } from "./db";

describe.skipIf(!hasDb)("free trial in the database", () => {
  let db: pg.Client;
  let user: string;

  beforeAll(async () => {
    db = await connect();
    user = await createUser(db, `trial-${Date.now()}@example.com`);
  });
  afterAll(async () => {
    await db.end();
  });

  it("starts every new account on a 14-day trial", async () => {
    const { rows } = await db.query("select plan, extract(epoch from trial_ends_at - created_at) / 86400 as days from profiles where id = $1", [user]);
    expect(rows[0].plan).toBe("trial");
    expect(Math.round(Number(rows[0].days))).toBe(14);
  });

  it("lets founders read their plan but never change it", async () => {
    const { rows } = await as(db, "authenticated", user, () => db.query("select plan, trial_ends_at from profiles"));
    expect(rows).toHaveLength(1);
    await expect(as(db, "authenticated", user, () => db.query("update profiles set plan = 'active'"))).rejects.toThrow(/permission denied/);
    await expect(as(db, "authenticated", user, () => db.query("update profiles set trial_ends_at = now() + interval '10 years'"))).rejects.toThrow(/permission denied/);
  });
});
