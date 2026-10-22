"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { adminClient } from "@/lib/supabase/admin";
import { TRIAL_DAYS } from "@/lib/trial";
import { isUuid } from "@/lib/validate";

// The owner's switches for an account: activate (paid), extend the trial, or end access.
export async function setAccess(form: FormData): Promise<void> {
  await requireAdmin();
  const id = form.get("id");
  const action = form.get("action");
  if (!isUuid(id)) return;
  const admin = adminClient();
  if (action === "activate") {
    await admin.from("profiles").update({ plan: "active" }).eq("id", id);
  } else if (action === "end") {
    await admin.from("profiles").update({ plan: "ended" }).eq("id", id);
  } else if (action === "extend") {
    const { data } = await admin.from("profiles").select("trial_ends_at").eq("id", id).single();
    const from = Math.max(Date.now(), data ? new Date(data.trial_ends_at).getTime() : 0);
    await admin
      .from("profiles")
      .update({ plan: "trial", trial_ends_at: new Date(from + TRIAL_DAYS * 86_400_000).toISOString() })
      .eq("id", id);
  }
  revalidatePath("/admin");
}
