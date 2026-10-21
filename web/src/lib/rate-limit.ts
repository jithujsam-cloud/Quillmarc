import "server-only";
import { headers } from "next/headers";
import { sha256 } from "./crypto";
import { adminClient } from "./supabase/admin";

/** True when allowed. Fails open if the database is unreachable, so an outage does not lock everyone out. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc("rate_limit_hit", { p_key: sha256(key), p_limit: limit, p_window_seconds: windowSeconds });
  if (error) return true;
  return data === true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
