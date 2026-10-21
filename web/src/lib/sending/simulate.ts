// MOCK MODE ONLY. Creates simulated webhook events so the status table can be tried without
// Resend. Never runs when EMAIL_PROVIDER=resend. Events are marked { simulated: true }.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendRow } from "../db-types";
import { ingestResendEvent } from "../webhooks/resend";

export async function simulateEvents(admin: SupabaseClient, updateId: string): Promise<number> {
  const { data } = await admin.from("sends").select("*").eq("update_id", updateId).eq("status", "sent").order("created_at");
  let stored = 0;
  const sends = (data ?? []) as SendRow[];
  for (const [i, s] of sends.entries()) {
    if (!s.resend_message_id || !s.sent_at) continue;
    const at = (seconds: number) => new Date(new Date(s.sent_at as string).getTime() + seconds * 1000).toISOString();
    // A spread of outcomes: delivered only, an automatic open, a real open, and one bounce.
    const plan: [string, number][] = [["email.sent", 1]];
    if (i === sends.length - 1 && sends.length > 2) plan.push(["email.bounced", 4]);
    else {
      plan.push(["email.delivered", 3]);
      if (i % 3 === 1) plan.push(["email.opened", 6]);
      if (i % 3 === 2) plan.push(["email.opened", 600]);
    }
    for (const [type, offset] of plan) {
      const r = await ingestResendEvent(
        admin,
        { type, created_at: at(offset), data: { email_id: s.resend_message_id, simulated: true, bounce: { type: "Permanent" } } },
        `sim_${s.id}_${type}`,
      );
      if (r === "stored") stored++;
    }
  }
  return stored;
}
