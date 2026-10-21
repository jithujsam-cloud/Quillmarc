"use server";
// Server actions for creating, editing and sending an update.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "../auth";
import { computeMetrics } from "../billing";
import type { UpdateRow } from "../db-types";
import type { Bullets } from "../email/render";
import { EDITABLE_KEYS, parseAdjustment, type Adjustments } from "../metrics/present";
import { monthChoices } from "../months";
import { rateLimit } from "../rate-limit";
import { queueConfig } from "../sending/config";
import { enqueueSends, processQueue, sendTest, SendGateError } from "../sending/queue";
import { adminClient } from "../supabase/admin";
import { isMonth, isUuid } from "../validate";
import type { FormState } from "./setup";

const MAX_BULLETS = 10;
const MAX_BULLET_LENGTH = 500;

/** Load an update the signed-in founder owns. Row level security does the ownership check. */
async function ownUpdate(id: unknown) {
  const { supabase, user } = await requireUser();
  if (!isUuid(id)) redirect("/dashboard");
  const { data } = await supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>();
  if (!data) redirect("/dashboard");
  return { supabase, user, update: data };
}

export async function createUpdate(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const month = form.get("month");
  if (!isMonth(month) || !monthChoices().includes(month)) return { error: "Choose a month from the list." };

  const { data: existing } = await supabase.from("updates").select("id").eq("user_id", user.id).eq("month", `${month}-01`).maybeSingle();
  if (existing) redirect(`/updates/${existing.id}/edit`);

  let metrics;
  try {
    metrics = await computeMetrics(user.id, month);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { data, error } = await supabase.from("updates").insert({ user_id: user.id, month: `${month}-01`, metrics_json: metrics }).select("id").single();
  if (error || !data) return { error: "Could not create the update. Try again." };
  redirect(`/updates/${data.id}/edit`);
}

export async function recalculate(form: FormData): Promise<void> {
  const { supabase, user, update } = await ownUpdate(form.get("id"));
  if (update.status !== "draft") redirect(`/updates/${update.id}`);
  try {
    const metrics = await computeMetrics(user.id, update.month.slice(0, 7));
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
  const { user, update } = await ownUpdate(form.get("id"));
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
  const { update } = await ownUpdate(form.get("id"));
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
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
