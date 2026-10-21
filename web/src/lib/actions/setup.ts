"use server";
// Server actions for Stripe, investors, sender details and account deletion.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import { encrypt } from "../crypto";
import { env } from "../env";
import { parseInvestorList } from "../investors";
import { domainAcceptsMail } from "../mx";
import { validateRestrictedKey } from "../stripe/restricted-key";
import { deauthorize } from "../stripe/connect";
import { adminClient } from "../supabase/admin";
import { rateLimit } from "../rate-limit";
import { cleanText, isEmail, isNoReplyAddress, isUuid, normalizeEmail } from "../validate";

export interface FormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function connectStripe(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!(await rateLimit(`stripe:${user.id}`, 10, 600))) return { error: "Too many attempts. Wait a few minutes and try again." };
  const key = String(form.get("key") ?? "").trim();
  const check = await validateRestrictedKey(key);
  if (!check.ok) return { error: check.error };

  await revokeConnect(user.id);
  const { error } = await adminClient()
    .from("stripe_connections")
    .upsert(
      {
        user_id: user.id,
        method: "restricted_key",
        stripe_account_id: null,
        account_name: null,
        encrypted_key: encrypt(key, env.encryptionKey()),
        key_mode: check.mode,
        key_last4: check.last4,
        status: "connected",
        last_checked_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "user_id" },
    );
  if (error) return { error: "Could not save the connection. Try again." };
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next"), "/onboarding?step=2"));
}

/** If the founder linked Stripe with Connect, revoke Quillmarc's access on Stripe's side too. */
async function revokeConnect(userId: string): Promise<void> {
  const cfg = env.stripeConnect();
  const { data } = await adminClient().from("stripe_connections").select("method, stripe_account_id").eq("user_id", userId).maybeSingle();
  if (cfg && data?.method === "oauth" && data.stripe_account_id) await deauthorize(cfg, data.stripe_account_id);
}

export async function disconnectStripe(): Promise<void> {
  const { user } = await requireUser();
  await revokeConnect(user.id);
  // Deletes the row, and with it the encrypted key or the account id.
  await adminClient().from("stripe_connections").delete().eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/settings?done=disconnected");
}

export async function addInvestors(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const text = String(form.get("list") ?? "").slice(0, 100_000);
  const { data: existing } = await supabase.from("investors").select("email").eq("user_id", user.id);
  const parsed = parseInvestorList(text, (existing ?? []).map((r) => r.email));

  if (parsed.investors.length) {
    const { error } = await supabase.from("investors").insert(parsed.investors.map((i) => ({ ...i, user_id: user.id })));
    if (error) return { error: "Could not save the list. Try again." };
  }
  // Re-apply the suppression list so a bounced address stays suppressed when re-added.
  const { data: sup } = await supabase.from("suppressions").select("email, reason").eq("user_id", user.id);
  for (const s of sup ?? []) {
    if (parsed.investors.some((i) => i.email === s.email.toLowerCase())) {
      await adminClient().from("investors").update({ suppressed: true, suppressed_reason: s.reason }).eq("user_id", user.id).ilike("email", s.email);
    }
  }
  revalidatePath("/investors");
  revalidatePath("/onboarding");

  const parts = [`Added ${parsed.investors.length} ${parsed.investors.length === 1 ? "investor" : "investors"}.`];
  if (parsed.duplicates) parts.push(`Skipped ${parsed.duplicates} ${parsed.duplicates === 1 ? "duplicate" : "duplicates"}.`);
  if (parsed.errors.length) {
    const lines = parsed.errors.slice(0, 5).map((e) => (e.line ? `Line ${e.line}: ${e.reason}.` : `${e.reason}.`));
    return { message: parts.join(" "), error: `${parsed.errors.length} ${parsed.errors.length === 1 ? "line was" : "lines were"} not added. ${lines.join(" ")}` };
  }
  if (!parsed.investors.length && !parsed.duplicates) return { error: "Paste at least one line with a name and an email." };
  return { message: parts.join(" ") };
}

export async function removeInvestor(form: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const id = form.get("id");
  if (isUuid(id)) await supabase.from("investors").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/investors");
}

export async function saveSender(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const founder = cleanText(form.get("founder_name"), 80);
  const company = cleanText(form.get("company_name"), 80);
  const replyRaw = String(form.get("reply_to_email") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!founder) fieldErrors.founder_name = "Add your name.";
  if (!company) fieldErrors.company_name = "Add your company name.";
  if (!isEmail(replyRaw)) fieldErrors.reply_to_email = "Enter a valid email address.";
  else if (isNoReplyAddress(replyRaw)) fieldErrors.reply_to_email = "Use an inbox you read. Investors will reply to it.";
  else if (!(await domainAcceptsMail(replyRaw))) fieldErrors.reply_to_email = "That domain does not accept email. Check the spelling.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { error } = await supabase
    .from("profiles")
    .update({ founder_name: founder, company_name: company, reply_to_email: normalizeEmail(replyRaw), updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Could not save. Try again." };
  revalidatePath("/", "layout");
  const next = form.get("next");
  if (next) redirect(safeNext(next, "/dashboard"));
  return { message: "Saved." };
}

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  await revokeConnect(user.id);
  // Deleting the auth user cascades to every table: profile, Stripe key, investors, updates, sends, events, suppressions.
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) return { error: "Could not delete your data. Try again, or email us." };
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
