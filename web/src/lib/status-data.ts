import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, SendRow } from "./db-types";
import { deriveStatus, totals, type DerivedStatus, type StatusEvent } from "./sending/status";

export interface SendStatusRow {
  send: SendRow;
  events: StatusEvent[];
  derived: DerivedStatus;
  sendStatus: SendRow["status"];
}

/** Every send of one update with its derived status. Row level security limits it to the founder's own. */
export async function loadSendStatuses(supabase: SupabaseClient, updateId: string) {
  const { data: sendData } = await supabase.from("sends").select("*, investors(opted_out)").eq("update_id", updateId).order("investor_name");
  const sends = (sendData ?? []) as (SendRow & { investors: { opted_out: boolean } | null })[];
  const { data: eventData } = sends.length
    ? await supabase.from("events").select("send_id, type, occurred_at").in("send_id", sends.map((s) => s.id))
    : { data: [] };
  const events = (eventData ?? []) as Pick<EventRow, "send_id" | "type" | "occurred_at">[];
  const rows: SendStatusRow[] = sends.map((s) => {
    const ev = events.filter((e) => e.send_id === s.id).map((e) => ({ type: e.type, occurredAt: e.occurred_at }));
    return {
      send: s,
      events: ev,
      sendStatus: s.status,
      derived: deriveStatus({ sendStatus: s.status, sentAt: s.sent_at, createdAt: s.created_at, events: ev, investorOptedOut: Boolean(s.investors?.opted_out) }),
    };
  });
  return { rows, totals: totals(rows) };
}
