// Hosted page reads and opt-outs. Called with the service role, looked up by the unguessable token.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isWellFormedToken } from "./crypto";
import type { ProfileRow, SendRow, UpdateRow } from "./db-types";

/** Reads within this window count once. Reloading the page is not a second read. */
export const READ_DEDUPE_MINUTES = 30;

export async function findByToken(admin: SupabaseClient, token: string): Promise<{ send: SendRow; update: UpdateRow; profile: ProfileRow } | null> {
  if (!isWellFormedToken(token)) return null;
  const { data: send } = await admin.from("sends").select("*").eq("token", token).maybeSingle<SendRow>();
  if (!send) return null;
  const [{ data: update }, { data: profile }] = await Promise.all([
    admin.from("updates").select("*").eq("id", send.update_id).single<UpdateRow>(),
    admin.from("profiles").select("*").eq("id", send.user_id).single<ProfileRow>(),
  ]);
  if (!update || !profile) return null;
  return { send, update, profile };
}

export async function recordRead(admin: SupabaseClient, token: string): Promise<boolean> {
  if (!isWellFormedToken(token)) return false;
  const { data: send } = await admin.from("sends").select("id, user_id, status").eq("token", token).maybeSingle<Pick<SendRow, "id" | "user_id" | "status">>();
  if (!send || send.status !== "sent") return false;
  const since = new Date(Date.now() - READ_DEDUPE_MINUTES * 60000).toISOString();
  const { count } = await admin.from("events").select("id", { count: "exact", head: true }).eq("send_id", send.id).eq("type", "read").gte("occurred_at", since);
  if (count) return true;
  await admin.from("events").insert({ user_id: send.user_id, send_id: send.id, type: "read", occurred_at: new Date().toISOString(), raw: { source: "hosted_page" } });
  return true;
}

/** Opt an investor out of every future update from this founder. Idempotent. */
export async function optOut(admin: SupabaseClient, token: string): Promise<boolean> {
  if (!isWellFormedToken(token)) return false;
  const { data: send } = await admin.from("sends").select("id, user_id, investor_id").eq("token", token).maybeSingle<Pick<SendRow, "id" | "user_id" | "investor_id">>();
  if (!send) return false;
  const { data: inv } = await admin.from("investors").update({ opted_out: true, opted_out_at: new Date().toISOString() }).eq("id", send.investor_id).eq("opted_out", false).select("id");
  if (inv?.length) {
    await admin.from("events").insert({ user_id: send.user_id, send_id: send.id, type: "opted_out", occurred_at: new Date().toISOString(), raw: { source: "unsubscribe" } });
  }
  return true;
}
