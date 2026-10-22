"use server";
// Server actions for creating, editing and sending an update.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "../auth";
import { computePeriodMetrics } from "../billing";
import type { UpdateRow } from "../db-types";
import type { Bullets } from "../email/render";
import { EDITABLE_KEYS, parseAdjustment, type Adjustments } from "../metrics/present";
import { isPeriodType, periodFromRow, validatePeriod, type Period } from "../periods";
import { rateLimit } from "../rate-limit";
import { queueConfig } from "../sending/config";
import { enqueueSends, processQueue, sendTest, SendGateError } from "../sending/queue";
import { adminClient } from "../supabase/admin";
import { isUuid } from "../validate";
import { accessFor, TRIAL_ENDED_MESSAGE } from "../trial";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormState } from "./setup";

const MAX_BULLETS = 10;
const MAX_BULLET_LENGTH = 500;

/** The trial gate. Checked on the server for every action that creates or sends. */
async function canSend(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("plan, trial_ends_at").eq("id", userId).maybeSingle();
  return accessFor(data ?? {}).canSend;
}

/** Load an update the signed-in founder owns. Row level security does the ownership check. */
async function ownUpdate(id: unknown) {
  const { supabase, user } = await requireUser();
  if (!isUuid(id)) redirect("/updates");
  const { data } = await supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>();
  if (!data) redirect("/updates");
  return { supabase, user, update: data };
}

/** The period a form asks for: a preset arrives as "start_end", a custom range as two dates. */
function periodFromForm(form: FormData): Period | null {
  const type = form.get("type");
  if (!isPeriodType(type)) return null;
  if (type === "custom") return { type, start: String(form.get("start") ?? ""), end: String(form.get("end") ?? "") };
  const [start, end] = String(form.get("period") ?? "").split("_");
  return start && end ? { type, start, end } : null;
}

export async function createUpdate(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  if (!(await canSend(supabase, user.id))) return { error: TRIAL_ENDED_MESSAGE };
  const period = periodFromForm(form);
  if (!period) return { error: "Choose how often this update covers, then the period." };
  const problem = validatePeriod(period);
  if (problem) return { error: problem };

  const { data: existing } = await supabase
    .from("updates")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("period_type", period.type)
    .eq("period_start", period.start)
    .eq("period_end", period.end)
    .maybeSingle();
  if (existing) redirect(existing.status === "draft" ? `/updates/${existing.id}/edit` : `/updates/${existing.id}`);

  let metrics;
  try {
    metrics = await computePeriodMetrics(user.id, period);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { data, error } = await supabase
    .from("updates")
    .insert({ user_id: user.id, month: `${period.start.slice(0, 7)}-01`, period_type: period.type, period_start: period.start, period_end: period.end, metrics_json: metrics })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the update. Try again." };
  // Open asks go into the new draft, so nothing the founder is still waiting on is forgotten.
  const { data: open } = await supabase.from("asks").select("text").eq("user_id", user.id).in("status", ["open", "intro_made"]).order("created_at").limit(MAX_BULLETS);
  if (open?.length) await supabase.from("updates").update({ bullets_json: { wins: [], problems: [], asks: open.map((a) => String(a.text).slice(0, MAX_BULLET_LENGTH)) } }).eq("id", data.id);
  revalidatePath("/updates");
  redirect(`/updates/${data.id}/edit`);
}

export async function recalculate(form: FormData): Promise<void> {
  const { supabase, user, update } = await ownUpdate(form.get("id"));
  if (update.status !== "draft") redirect(`/updates/${update.id}`);
  try {
    const metrics = await computePeriodMetrics(user.id, periodFromRow(update));
    await supabase.from("updates").update({ metrics_json: metrics, updated_at: new Date().toISOString() }).eq("id", update.id);
  } catch {
    redirect(`/updates/${update.id}/edit?step=metrics&error=stripe`);
  }
  revalidatePath(`/updates/${update.id}/edit`);
  redirect(`/updates/${update.id}/edit?step=metrics`);
}

export async function saveAdjustments(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, update } = await ownUpdate(form.get("id"));
  if (update.status !== "draft" || !update.metrics_json) return { error: "This update can no longer be edited." };
  const m = update.metrics_json;
  const next: Adjustments = {};
  const fieldErrors: Record<string, string> = {};
  for (const key of EDITABLE_KEYS) {
    const raw = form.get(key);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const value = parseAdjustment(key, raw, m.currency);
    if (value === null) {
      fieldErrors[key] = "Enter a whole, positive number.";
      continue;
    }
    if (value !== m[key]) next[key] = value;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  await supabase.from("updates").update({ adjustments_json: next, updated_at: new Date().toISOString() }).eq("id", update.id);
  revalidatePath(`/updates/${update.id}/edit`);
  if (form.get("continue")) redirect(`/updates/${update.id}/edit?step=bullets`);
  return { message: "Saved." };
}

function lines(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
    .map((l) => l.slice(0, MAX_BULLET_LENGTH));
}

export async function saveBullets(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, update } = await ownUpdate(form.get("id"));
  if (update.status !== "draft") return { error: "This update can no longer be edited." };
  const bullets: Bullets = { wins: lines(form.get("wins")), problems: lines(form.get("problems")), asks: lines(form.get("asks")) };
  await supabase.from("updates").update({ bullets_json: bullets, updated_at: new Date().toISOString() }).eq("id", update.id);
  revalidatePath(`/updates/${update.id}/edit`);
  if (form.get("continue")) redirect(`/updates/${update.id}/edit?step=preview`);
  return { message: "Saved." };
}

export async function saveRecipients(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, update } = await ownUpdate(form.get("id"));
  if (update.status !== "draft") return { error: "This update can no longer be edited." };
  const chosen = new Set(form.getAll("recipient").map(String));
  const { data: investors } = await supabase.from("investors").select("id").eq("user_id", user.id);
  const excluded = (investors ?? []).map((i) => i.id as string).filter((id) => !chosen.has(id));
  await supabase
    .from("updates")
    .update({ excluded_investor_ids: excluded, copy_to_founder: form.get("copy") === "on", updated_at: new Date().toISOString() })
    .eq("id", update.id);
  revalidatePath(`/updates/${update.id}/edit`);
  if (form.get("continue")) redirect(`/updates/${update.id}/edit?step=send`);
  return { message: "Saved." };
}

export async function sendTestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, update } = await ownUpdate(form.get("id"));
  if (!(await canSend(supabase, user.id))) return { error: TRIAL_ENDED_MESSAGE };
  if (!(await rateLimit(`test:${user.id}`, 5, 600))) return { error: "That is a lot of tests. Wait a few minutes." };
  try {
    await sendTest(adminClient(), queueConfig(), update.id);
  } catch (e) {
    return { error: e instanceof SendGateError ? e.message : "The test did not send. Try again in a minute." };
  }
  revalidatePath(`/updates/${update.id}/edit`);
  return { message: `Test sent to ${user.email}.` };
}

export async function sendToInvestors(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, update } = await ownUpdate(form.get("id"));
  if (!(await canSend(supabase, user.id))) return { error: TRIAL_ENDED_MESSAGE };
  if (form.get("confirm") !== "yes") return { error: "Confirm before sending." };
  if (!update.test_sent_at) return { error: "Send a test to yourself first." };
  const admin = adminClient();
  try {
    await enqueueSends(admin, update.id);
  } catch (e) {
    return { error: e instanceof SendGateError ? e.message : "Could not start sending. Try again." };
  }
  // Start delivering right away. The status page keeps the queue moving if this stops early.
  after(() => processQueue(admin, queueConfig(), update.id).catch(() => undefined));
  redirect(`/updates/${update.id}`);
}

export async function deleteDraft(form: FormData): Promise<void> {
  const { supabase, update } = await ownUpdate(form.get("id"));
  if (update.status === "draft") await supabase.from("updates").delete().eq("id", update.id);
  revalidatePath("/updates");
  redirect("/updates");
}
