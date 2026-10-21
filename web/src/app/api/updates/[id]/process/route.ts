import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { queueConfig } from "@/lib/sending/config";
import { processQueue } from "@/lib/sending/queue";
import { isUuid } from "@/lib/validate";

export const maxDuration = 60;

// Moves the send queue forward. Called by the status page while sends are queued.
// Safe to call any number of times: rows are claimed atomically and sends are idempotent.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { data: update } = await supabase.from("updates").select("id, status").eq("id", id).maybeSingle();
  if (!update) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (update.status !== "sending") return NextResponse.json({ remaining: 0 });

  const result = await processQueue(adminClient(), queueConfig({ timeBudgetMs: 15000 }), id);
  return NextResponse.json(result);
}
