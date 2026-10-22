import { NextResponse } from "next/server";
import { chargeSourceFor, NotConnectedError } from "@/lib/billing";
import { syncRevenue } from "@/lib/revenue";
import { adminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Moves the payment import forward. The dashboard calls it while history is still being imported.
// Safe to call any number of times: it takes a lock and does nothing while the data is fresh.
export async function POST() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  try {
    const result = await syncRevenue(adminClient(), auth.user.id, await chargeSourceFor(auth.user.id), { budgetMs: 15000 });
    return NextResponse.json({ complete: result.complete, busy: result.busy, error: result.error });
  } catch (e) {
    if (e instanceof NotConnectedError) return NextResponse.json({ complete: true, busy: false, error: null });
    return NextResponse.json({ complete: false, busy: false, error: "Could not read payments from Stripe." }, { status: 502 });
  }
}
