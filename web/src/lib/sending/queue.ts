// The send queue. One sends row per investor per update (unique pair), claimed atomically,
// sent with an idempotency key derived from the row id. A crash at any point is safe to retry:
//  - enqueue twice: the unique pair ignores the second insert
//  - crash after claiming: the row goes stale and is claimed again
//  - crash after the provider accepted but before we saved: the retry reuses the same
//    idempotency key, so the provider returns the original message instead of sending again
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken } from "../crypto";
import type { InvestorRow, ProfileRow, SendRow, UpdateRow } from "../db-types";
import { monthKey } from "../db-types";
import { firstName } from "../investors";
import { figures, monthLabel } from "../metrics/present";
import { EmailSendError, type EmailProvider } from "../email/provider";
import { renderUpdateEmail, type UpdateContent } from "../email/render";
import { headerSafe } from "../validate";

export interface QueueConfig {
  appUrl: string;
  sendingDomain: string;
  provider: EmailProvider;
  /** Pause between emails, to stay under the provider's rate limit. */
  delayMs?: number;
  batchSize?: number;
  /** A claimed row older than this is assumed abandoned by a crashed worker. */
  staleSeconds?: number;
  maxAttempts?: number;
  /** Stop picking up new rows after this long; the next call continues. */
  timeBudgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class SendGateError extends Error {
  name = "SendGateError";
}

const defaults = { delayMs: 600, batchSize: 10, staleSeconds: 120, maxAttempts: 3, timeBudgetMs: 20000 };
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function fromAddress(founderName: string, sendingDomain: string): string {
  return `"${headerSafe(founderName)} via Quillmarc" <updates@${sendingDomain}>`;
}

export function readUrl(appUrl: string, token: string) {
  return `${appUrl}/u/${token}`;
}

export function unsubscribeUrl(appUrl: string, token: string) {
  return `${appUrl}/u/${token}/stop`;
}

export async function loadContent(admin: SupabaseClient, updateId: string): Promise<{ update: UpdateRow; profile: ProfileRow; content: UpdateContent }> {
  const { data: update, error } = await admin.from("updates").select("*").eq("id", updateId).single<UpdateRow>();
  if (error || !update) throw new Error("Update not found");
  const { data: profile } = await admin.from("profiles").select("*").eq("id", update.user_id).single<ProfileRow>();
  if (!profile?.founder_name || !profile.company_name || !profile.reply_to_email) throw new SendGateError("Add your sender details first.");
  if (!update.metrics_json) throw new SendGateError("This update has no metrics yet.");
  return { update, profile, content: contentFor(update, profile) };
}

export function contentFor(update: UpdateRow, profile: ProfileRow): UpdateContent {
  return {
    founderName: profile.founder_name ?? "",
    companyName: profile.company_name ?? "",
    monthLabel: monthLabel(monthKey(update.month)),
    figures: update.metrics_json ? figures(update.metrics_json, update.adjustments_json) : [],
    bullets: update.bullets_json,
    sample: Boolean(update.metrics_json?.sample),
  };
}

/** Send the founder a test. Required before the real send. */
export async function sendTest(admin: SupabaseClient, cfg: QueueConfig, updateId: string): Promise<void> {
  const { update, profile, content } = await loadContent(admin, updateId);
  if (update.status !== "draft") throw new SendGateError("This update was already sent.");
  const email = renderUpdateEmail(content, {
    greetingName: firstName(profile.founder_name ?? ""),
    readUrl: `${cfg.appUrl}/updates/${update.id}/preview`,
    banner: "Test send. Only you received this. Investors see the same email with their own name and link.",
  });
  await cfg.provider.send({
    from: fromAddress(content.founderName, cfg.sendingDomain),
    to: profile.email,
    replyTo: profile.reply_to_email ?? undefined,
    subject: `[Test] ${email.subject}`,
    html: email.html,
    text: email.text,
    idempotencyKey: `test-${update.id}-${Date.now()}`,
  });
  await admin.from("updates").update({ test_sent_at: new Date().toISOString() }).eq("id", update.id);
}

/** Create one queued send per eligible investor. Safe to call more than once. */
export async function enqueueSends(admin: SupabaseClient, updateId: string): Promise<{ queued: number }> {
  const { update } = await loadContent(admin, updateId);
  if (!update.test_sent_at) throw new SendGateError("Send a test to yourself first.");
  if (update.status === "sent") throw new SendGateError("This update was already sent.");

  const [{ data: investors }, { data: suppressed }] = await Promise.all([
    admin.from("investors").select("*").eq("user_id", update.user_id).eq("opted_out", false).eq("suppressed", false),
    admin.from("suppressions").select("email").eq("user_id", update.user_id),
  ]);
  const blocked = new Set((suppressed ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  const excluded = new Set(update.excluded_investor_ids);
  const recipients = ((investors ?? []) as InvestorRow[]).filter((i) => !excluded.has(i.id) && !blocked.has(i.email.toLowerCase()));
  if (update.status === "draft" && recipients.length === 0) throw new SendGateError("No investors to send to.");

  if (recipients.length) {
    const rows = recipients.map((i) => ({
      user_id: update.user_id,
      update_id: update.id,
      investor_id: i.id,
      investor_name: i.name,
      investor_email: i.email,
      token: generateToken(),
    }));
    const { error } = await admin.from("sends").upsert(rows, { onConflict: "update_id,investor_id", ignoreDuplicates: true });
    if (error) throw new Error(`Could not queue sends: ${error.message}`);
  }
  await admin.from("updates").update({ status: "sending" }).eq("id", update.id).eq("status", "draft");
  const { count } = await admin.from("sends").select("id", { count: "exact", head: true }).eq("update_id", update.id);
  return { queued: count ?? 0 };
}

/** Send whatever is queued for this update, within the time budget. Returns what is left. */
export async function processQueue(admin: SupabaseClient, config: QueueConfig, updateId: string): Promise<{ sent: number; failed: number; remaining: number }> {
  const cfg = { ...defaults, sleep: realSleep, ...config };
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  const { update, profile, content } = await loadContent(admin, updateId);

  while (Date.now() - started < cfg.timeBudgetMs) {
    const { data: claimed, error } = await admin.rpc("claim_sends", { p_update_id: updateId, p_limit: cfg.batchSize, p_stale_seconds: cfg.staleSeconds });
    if (error) throw new Error(`Could not claim sends: ${error.message}`);
    const batch = (claimed ?? []) as SendRow[];
    if (!batch.length) break;

    for (const s of batch) {
      // Re-check right before sending: the investor may have opted out or bounced since queueing.
      const [{ data: inv }, { data: sup }] = await Promise.all([
        admin.from("investors").select("opted_out, suppressed").eq("id", s.investor_id).maybeSingle(),
        admin.from("suppressions").select("id").eq("user_id", s.user_id).eq("email", s.investor_email.toLowerCase()).maybeSingle(),
      ]);
      if (!inv || inv.opted_out || inv.suppressed || sup) {
        await admin.from("sends").update({ status: "skipped", last_error: !inv ? "investor removed" : inv.opted_out ? "opted out" : "suppressed" }).eq("id", s.id);
        continue;
      }

      const email = renderUpdateEmail(content, {
        greetingName: firstName(s.investor_name),
        readUrl: readUrl(cfg.appUrl, s.token),
        unsubscribeUrl: unsubscribeUrl(cfg.appUrl, s.token),
      });
      try {
        const { id } = await cfg.provider.send({
          from: fromAddress(content.founderName, cfg.sendingDomain),
          to: s.investor_email,
          replyTo: profile.reply_to_email ?? undefined,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: {
            "List-Unsubscribe": `<${cfg.appUrl}/api/unsubscribe?token=${s.token}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          idempotencyKey: `send-${s.id}`,
        });
        await admin.from("sends").update({ status: "sent", resend_message_id: id, sent_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
        sent++;
      } catch (e) {
        const retryable = e instanceof EmailSendError ? e.retryable : true;
        const giveUp = !retryable || s.attempts >= cfg.maxAttempts;
        await admin.from("sends").update({ status: giveUp ? "failed" : "queued", last_error: String((e as Error).message).slice(0, 300) }).eq("id", s.id);
        if (giveUp) failed++;
        await cfg.sleep(cfg.delayMs * 3);
      }
      await cfg.sleep(cfg.delayMs);
    }
  }

  const { count } = await admin.from("sends").select("id", { count: "exact", head: true }).eq("update_id", updateId).in("status", ["queued", "sending"]);
  const remaining = count ?? 0;
  if (remaining === 0) {
    await admin.from("updates").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", updateId).eq("status", "sending");
    await sendFounderCopy(admin, cfg, update, profile, content);
  }
  return { sent, failed, remaining };
}

/** "Send me a copy": a separate email to the founder, never a BCC. Sent once. */
async function sendFounderCopy(admin: SupabaseClient, cfg: QueueConfig, update: UpdateRow, profile: ProfileRow, content: UpdateContent) {
  if (!update.copy_to_founder || update.copy_sent_at) return;
  const email = renderUpdateEmail(content, {
    greetingName: firstName(profile.founder_name ?? ""),
    readUrl: `${cfg.appUrl}/updates/${update.id}/preview`,
    banner: "Your copy. This is what your investors received, with their own name and link.",
  });
  await cfg.provider.send({
    from: fromAddress(content.founderName, cfg.sendingDomain),
    to: profile.email,
    replyTo: profile.reply_to_email ?? undefined,
    subject: `[Your copy] ${email.subject}`,
    html: email.html,
    text: email.text,
    idempotencyKey: `copy-${update.id}`,
  });
  await admin.from("updates").update({ copy_sent_at: new Date().toISOString() }).eq("id", update.id);
}
