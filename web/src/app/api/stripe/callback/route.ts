import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { accountName, deauthorize, exchangeCode } from "@/lib/stripe/connect";
import { decodeState, returnPath, STATE_COOKIE } from "@/lib/stripe/oauth-state";
import { adminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

// Step 2 of Connect with Stripe: Stripe sends the founder back here with a one-time code.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const saved = decodeState(request.cookies.get(STATE_COOKIE)?.value);
  const finish = (code: string) => {
    const res = NextResponse.redirect(new URL(returnPath(saved?.returnTo ?? "onboarding", code), env.appUrl()), 303);
    res.cookies.set(STATE_COOKIE, "", { path: "/api/stripe", maxAge: 0 });
    return res;
  };

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", env.appUrl()), 303);

  if (q.get("error")) return finish("denied");
  const state = q.get("state") ?? "";
  if (!saved || saved.userId !== data.user.id || !safeEqual(state, saved.state)) return finish("expired");

  const cfg = env.stripeConnect();
  if (!cfg) return finish("unavailable");
  const result = await exchangeCode(cfg, q.get("code") ?? "");
  if (!result.ok) return finish(result.code);

  const admin = adminClient();
  // Switching Stripe accounts: revoke Quillmarc's access to the old one first.
  const { data: prev } = await admin.from("stripe_connections").select("method, stripe_account_id").eq("user_id", data.user.id).maybeSingle();
  if (prev?.method === "oauth" && prev.stripe_account_id && prev.stripe_account_id !== result.accountId) {
    await deauthorize(cfg, prev.stripe_account_id);
  }

  const { error } = await admin.from("stripe_connections").upsert(
    {
      user_id: data.user.id,
      method: "oauth",
      stripe_account_id: result.accountId,
      account_name: await accountName(cfg, result.accountId),
      encrypted_key: null,
      key_last4: null,
      key_mode: result.livemode ? "live" : "test",
      status: "connected",
      last_checked_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "user_id" },
  );
  if (error) return finish("failed");
  return finish("connected");
}
