import { NextResponse } from "next/server";
import { chargeSourceFor, ensureSnapshots, NotConnectedError } from "@/lib/billing";
import { syncRevenue } from "@/lib/revenue";
import { adminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Brings the dashboard's saved figures up to date from Stripe. The page itself shows what is saved
// straight away and calls this in the background, so opening it never waits on Stripe.
// Safe to call often: both parts do nothing while their data is fresh.
export async function POST() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const id = auth.user.id;

  const [snapshots, revenue] = await Promise.allSettled([ensureSnapshots(id), chargeSourceFor(id).then((source) => syncRevenue(adminClient(), id, source, { budgetMs: 8000 }))]);

  let error: string | null = null;
  if (snapshots.status === "rejected" && !(snapshots.reason instanceof NotConnectedError)) error = (snapshots.reason as Error).message;
  if (!error && revenue.status === "fulfilled") error = revenue.value.error;
  if (!error && revenue.status === "rejected" && !(revenue.reason instanceof NotConnectedError)) error = "Could not read payments from Stripe.";
  return NextResponse.json({ complete: revenue.status === "fulfilled" ? revenue.value.complete : true, error });
}
