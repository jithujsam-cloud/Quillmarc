// Stores Resend webhook events against the send they belong to.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendRow } from "../db-types";
import type { EventType } from "../sending/status";

export const RESEND_EVENT_TYPES: Record<string, EventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { type?: string } } & Record<string, unknown>;
}

export type IngestResult = "stored" | "duplicate" | "ignored";

export async function ingestResendEvent(admin: SupabaseClient, payload: ResendWebhookPayload, svixId: string): Promise<IngestResult> {
  const type = payload.type ? RESEND_EVENT_TYPES[payload.type] : undefined;
  const emailId = payload.data?.email_id;
  if (!type || !emailId) return "ignored";

  // Test sends and founder copies have no sends row, so their events are ignored.
  const { data: send } = await admin.from("sends").select("*").eq("resend_message_id", emailId).maybeSingle<SendRow>();
  if (!send) return "ignored";

  const occurred = payload.created_at && !Number.isNaN(Date.parse(payload.created_at)) ? payload.created_at : new Date().toISOString();
  const { error } = await admin.from("events").insert({
    user_id: send.user_id,
    send_id: send.id,
    type,
    occurred_at: occurred,
    raw: payload,
    svix_id: svixId,
  });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(`Could not store event: ${error.message}`);
  }

  // A transient bounce (mailbox full, server busy) is not a reason to stop emailing someone.
  const transient = type === "bounced" && /transient/i.test(payload.data?.bounce?.type ?? "");
  if ((type === "bounced" && !transient) || type === "complained") {
    await suppress(admin, send, type);
  }
  return "stored";
}

export async function suppress(admin: SupabaseClient, send: Pick<SendRow, "user_id" | "investor_id" | "investor_email">, reason: "bounced" | "complained") {
  const { error } = await admin.from("suppressions").insert({ user_id: send.user_id, email: send.investor_email.toLowerCase(), reason });
  if (error && error.code !== "23505") throw new Error(`Could not suppress: ${error.message}`);
  await admin.from("investors").update({ suppressed: true, suppressed_reason: reason }).eq("id", send.investor_id);
}
