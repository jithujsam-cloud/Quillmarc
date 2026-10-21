// Service role client. Bypasses row level security. Server only, and only for:
// the Stripe key, delivery records, webhooks, hosted pages, rate limits and account deletion.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
