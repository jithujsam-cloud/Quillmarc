import { NextResponse, type NextRequest } from "next/server";
import { generateToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { authorizeUrl } from "@/lib/stripe/connect";
import { encodeState, returnPath, STATE_COOKIE, STATE_MAX_AGE, type ReturnTo } from "@/lib/stripe/oauth-state";
import { createUserClient } from "@/lib/supabase/server";

// Step 1 of Connect with Stripe: remember a random state, then send the founder to Stripe.
export async function GET(request: NextRequest) {
  const returnTo: ReturnTo = request.nextUrl.searchParams.get("from") === "settings" ? "settings" : "onboarding";
  const back = (code: string) => NextResponse.redirect(new URL(returnPath(returnTo, code), env.appUrl()), 303);

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", env.appUrl()), 303);

  const cfg = env.stripeConnect();
  if (!cfg) return back("unavailable");
  if (!(await rateLimit(`stripe-connect:${data.user.id}`, 10, 600))) return back("busy");

  const state = generateToken();
  const res = NextResponse.redirect(authorizeUrl(cfg, state), 303);
  res.cookies.set(STATE_COOKIE, encodeState({ state, userId: data.user.id, returnTo }), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    // Lax, so the cookie comes back on Stripe's top-level redirect to us.
    sameSite: "lax",
    maxAge: STATE_MAX_AGE,
    path: "/api/stripe",
  });
  return res;
}
