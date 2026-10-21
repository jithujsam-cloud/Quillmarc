import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { as, connect, createUser, hasDb } from "./db";

describe.skipIf(!hasDb)("stripe connections table", () => {
  let db: pg.Client;
  let user: string;

  beforeAll(async () => {
    db = await connect();
    user = await createUser(db, `connect-${Date.now()}@example.com`);
  });
  afterAll(async () => {
    await db.end();
  });

  it("needs an account id for Connect and a key for a restricted key", async () => {
    await expect(db.query("insert into stripe_connections (user_id, method) values ($1, 'oauth')", [user])).rejects.toThrow(/method_fields/);
    await expect(db.query("insert into stripe_connections (user_id, method) values ($1, 'restricted_key')", [user])).rejects.toThrow(/method_fields/);
    await expect(db.query("insert into stripe_connections (user_id, method, stripe_account_id) values ($1, 'oauth', 'not-an-account')", [user])).rejects.toThrow(/stripe_account_id/);
    await db.query("insert into stripe_connections (user_id, method, stripe_account_id, account_name) values ($1, 'oauth', 'acct_1ABC', 'Ledgerlane')", [user]);
  });

  it("lets the founder see the account name but not the account id", async () => {
    const { rows } = await as(db, "authenticated", user, () => db.query("select method, account_name from stripe_connections"));
    expect(rows).toEqual([{ method: "oauth", account_name: "Ledgerlane" }]);
    await expect(as(db, "authenticated", user, () => db.query("select stripe_account_id from stripe_connections"))).rejects.toThrow(/permission denied/);
  });
});
