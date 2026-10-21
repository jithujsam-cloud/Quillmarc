import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow, StripeConnectionRow } from "./db-types";

export interface SetupState {
  profile: ProfileRow | null;
  connection: StripeConnectionRow | null;
  investorCount: number;
  senderDone: boolean;
  /** 1, 2 or 3 for the first unfinished step, or null when setup is complete. */
  nextStep: 1 | 2 | 3 | null;
}

export async function getSetupState(supabase: SupabaseClient, userId: string): Promise<SetupState> {
  const [{ data: profile }, { data: connection }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase.from("stripe_connections").select("id, user_id, method, account_name, key_mode, key_last4, status, last_checked_at, last_error").eq("user_id", userId).maybeSingle<StripeConnectionRow>(),
    supabase.from("investors").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const senderDone = Boolean(profile?.founder_name && profile.company_name && profile.reply_to_email);
  const investorCount = count ?? 0;
  const nextStep = !connection ? 1 : investorCount === 0 ? 2 : !senderDone ? 3 : null;
  return { profile, connection, investorCount, senderDone, nextStep };
}
