"use server";
// Server actions for asks: add one, move it along, remove it.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth";
import type { AskStatus } from "../db-types";
import { cleanText, isUuid } from "../validate";
import type { FormState } from "./setup";

const STATUSES: AskStatus[] = ["open", "intro_made", "done"];

export async function addAsk(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const text = cleanText(form.get("text"), 500);
  if (!text) return { fieldErrors: { text: "Write what you are asking for." } };
  const investor = form.get("investor");
  const investorId = isUuid(investor) ? investor : null;
  const owner = cleanText(form.get("owner"), 80);
  const { error } = await supabase.from("asks").insert({ user_id: user.id, investor_id: investorId, text, owner });
  if (error) return { error: "Could not save that ask. Try again." };
  revalidatePath("/asks");
  revalidatePath("/dashboard");
  return { message: "Added." };
}

export async function setAskStatus(form: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = form.get("id");
  const status = form.get("status");
  if (!isUuid(id) || !STATUSES.includes(status as AskStatus)) redirect("/asks");
  const now = new Date().toISOString();
  await supabase
    .from("asks")
    .update({ status, resolved_at: status === "done" ? now : null, updated_at: now })
    .eq("id", id);
  revalidatePath("/asks");
  revalidatePath("/dashboard");
  redirect("/asks");
}

export async function deleteAsk(form: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = form.get("id");
  if (isUuid(id)) await supabase.from("asks").delete().eq("id", id);
  revalidatePath("/asks");
  revalidatePath("/dashboard");
  redirect("/asks");
}
