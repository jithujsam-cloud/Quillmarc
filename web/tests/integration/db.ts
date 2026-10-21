import pg from "pg";
import { inject } from "vitest";
import { createClient } from "@supabase/supabase-js";

export const dbUrl = inject("dbUrl");
export const hasDb = Boolean(dbUrl);
if (!hasDb) console.warn("Integration tests skipped: no Postgres or PostgREST available. See README, Testing.");

export async function connect() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  return client;
}

export async function createUser(client: pg.Client, email: string): Promise<string> {
  const { rows } = await client.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

/** A service-role Supabase client pointed at the local stack. */
export function adminClient() {
  return createClient(inject("supabaseUrl"), inject("serviceKey"), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Run `fn` inside a transaction as the given role, the way PostgREST does for a request. */
export async function as<T>(client: pg.Client, role: "authenticated" | "anon" | "service_role", userId: string | null, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
