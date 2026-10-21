import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifySvix } from "@/lib/webhooks/svix";
import { ingestResendEvent, type ResendWebhookPayload } from "@/lib/webhooks/resend";

// Resend delivery events. Signed with Svix, deduplicated on svix-id.
export async function POST(request: NextRequest) {
  if (!(await rateLimit(`webhook:${await clientIp()}`, 600, 60))) return new NextResponse("rate limited", { status: 429 });
  const body = await request.text();
  const svix = { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") };
  if (!verifySvix(env.resendWebhookSecret(), svix, body)) return new NextResponse("invalid signature", { status: 401 });

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new NextResponse("invalid body", { status: 400 });
  }
  try {
    const result = await ingestResendEvent(adminClient(), payload, svix.id as string);
    return NextResponse.json({ result });
  } catch {
    // A 500 makes Resend retry later, which is what we want if the database blipped.
    return new NextResponse("error", { status: 500 });
  }
}
