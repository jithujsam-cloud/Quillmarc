"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { simulateEvents } from "@/lib/sending/simulate";
import { adminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validate";

/** Mock mode only: pretend Resend sent webhooks, so the status table can be tried without keys. */
export async function simulate(form: FormData): Promise<void> {
  if (env.emailProvider() !== "mock") return;
  const { supabase } = await requireUser();
  const id = form.get("id");
  if (!isUuid(id)) return;
  const { data } = await supabase.from("updates").select("id").eq("id", id).maybeSingle();
  if (!data) return;
  await simulateEvents(adminClient(), id);
  revalidatePath(`/updates/${id}`);
}
