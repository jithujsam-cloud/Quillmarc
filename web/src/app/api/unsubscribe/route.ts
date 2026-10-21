import { env } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { optOut } from "@/lib/tracking";
import { isWellFormedToken } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// RFC 8058 one-click unsubscribe, from the List-Unsubscribe header. Mail apps POST here.
export async function POST(request: NextRequest) {
  if (!(await rateLimit(`unsub:${await clientIp()}`, 30, 60))) return new NextResponse(null, { status: 429 });
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (isWellFormedToken(token)) await optOut(adminClient(), token);
  return new NextResponse(null, { status: 200 });
}

// A person who opens the header link in a browser gets the confirm page.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const url = new URL(isWellFormedToken(token) ? `/u/${token}/stop` : "/", env.appUrl());
  return NextResponse.redirect(url);
}
