"use server";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { optOut } from "@/lib/tracking";
import { isWellFormedToken } from "@/lib/crypto";

export async function confirmOptOut(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  if (!isWellFormedToken(token)) redirect("/");
  await optOut(adminClient(), token);
  redirect(`/u/${token}/stop?done=1`);
}
