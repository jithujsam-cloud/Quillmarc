import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvestorRow, UpdateRow } from "./db-types";
import { activityFor, type Activity, type InvestorSend } from "./investor-activity";
import { periodFromRow, periodLabel } from "./periods";

export interface InvestorOverview {
  investors: InvestorRow[];
  activity: Map<string, Activity>;
  /** Investors who can be emailed and have gone quiet, the quietest first. */
  quiet: { id: string; name: string; missed: number }[];
  /** The newest update that went out. */
  last: { id: string; label: string; sentAt: string | null; reached: number; of: number; read: number } | null;
}

/** What the investors page and the dashboard need to know about who is reading. Row level security keeps it to the founder's own rows. */
export async function loadInvestorOverview(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<InvestorOverview> {
  const [{ data: inv }, { data: upd }, { data: snd }, { data: rd }] = await Promise.all([
    supabase.from("investors").select("*").eq("user_id", userId).order("name"),
    supabase.from("updates").select("id, period_type, period_start, period_end, status, sent_at, investor_total").eq("user_id", userId).in("status", ["sent", "sending"]),
    supabase.from("sends").select("id, investor_id, update_id, status").eq("user_id", userId),
    supabase.from("events").select("send_id, occurred_at").eq("user_id", userId).eq("type", "read"),
  ]);
  const investors = (inv ?? []) as InvestorRow[];
  const updates = (upd ?? []) as Pick<UpdateRow, "id" | "period_type" | "period_start" | "period_end" | "status" | "sent_at" | "investor_total">[];
  const sends = (snd ?? []) as { id: string; investor_id: string; update_id: string; status: string }[];
  const updateById = new Map(updates.map((u) => [u.id, u]));

  const readAt = new Map<string, string>(); // send id -> latest read
  for (const e of (rd ?? []) as { send_id: string; occurred_at: string }[]) {
    const had = readAt.get(e.send_id);
    if (!had || e.occurred_at > had) readAt.set(e.send_id, e.occurred_at);
  }

  const bySend = new Map<string, InvestorSend[]>();
  for (const s of sends) {
    const u = updateById.get(s.update_id);
    if (!u?.sent_at) continue;
    const list = bySend.get(s.investor_id) ?? [];
    list.push({ updateId: s.update_id, sentAt: u.sent_at, delivered: s.status === "sent", readAt: readAt.get(s.id) ?? null });
    bySend.set(s.investor_id, list);
  }

  const activity = new Map<string, Activity>();
  for (const i of investors) activity.set(i.id, activityFor(bySend.get(i.id) ?? [], now));

  const quiet = investors
    .filter((i) => !i.opted_out && !i.suppressed && activity.get(i.id)?.quiet)
    .map((i) => ({ id: i.id, name: i.name, missed: activity.get(i.id)?.missedInARow ?? 0 }))
    .sort((a, b) => b.missed - a.missed || a.name.localeCompare(b.name));

  const newest = updates.filter((u) => u.status === "sent" && u.sent_at).sort((a, b) => ((a.sent_at ?? "") < (b.sent_at ?? "") ? 1 : -1))[0];
  let last: InvestorOverview["last"] = null;
  if (newest) {
    const mine = sends.filter((s) => s.update_id === newest.id);
    last = {
      id: newest.id,
      label: periodLabel(periodFromRow(newest)),
      sentAt: newest.sent_at,
      reached: mine.filter((s) => s.status === "sent").length,
      of: newest.investor_total ?? mine.length,
      read: mine.filter((s) => s.status === "sent" && readAt.has(s.id)).length,
    };
  }
  return { investors, activity, quiet, last };
}
