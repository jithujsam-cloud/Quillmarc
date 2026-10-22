import { env } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/server";
import { afterEmailLink } from "@/lib/validate";

// The link in an email: confirm a new account, or start a password reset (?next=/reset-password).
// Supports the PKCE code flow and the token_hash email template flow.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createUserClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const next = type === "recovery" ? "/reset-password" : afterEmailLink(url.searchParams.get("next"));
  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", env.appUrl()));
}
