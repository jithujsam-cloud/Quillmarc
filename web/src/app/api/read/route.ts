import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { recordRead } from "@/lib/tracking";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!(await rateLimit(`read:${await clientIp()}`, 60, 60))) return new NextResponse(null, { status: 429 });
  let token = "";
  try {
    token = String(((await request.json()) as { token?: unknown }).token ?? "");
  } catch {}
  await recordRead(adminClient(), token);
  // Same answer whether or not the token exists, so the endpoint cannot be used to probe tokens.
  return new NextResponse(null, { status: 204 });
}
