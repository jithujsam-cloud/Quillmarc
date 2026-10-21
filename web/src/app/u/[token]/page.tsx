import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UpdateDocument } from "@/components/update/update-document";
import { firstName } from "@/lib/investors";
import { contentFor } from "@/lib/sending/queue";
import { adminClient } from "@/lib/supabase/admin";
import { findByToken } from "@/lib/tracking";
import { ReadBeacon } from "./read-beacon";

export const metadata: Metadata = { title: "Investor update", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HostedUpdatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findByToken(adminClient(), token);
  if (!found || found.update.status === "draft") notFound();
  const { send, update, profile } = found;
  const content = contentFor(update, profile);

  return (
    <div className="flex min-h-dvh flex-col">
      <ReadBeacon token={token} />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-12 sm:px-6 sm:pt-16">
        <UpdateDocument content={content} greetingName={firstName(send.investor_name)} warnings={update.metrics_json?.warnings} />
        {profile.reply_to_email && (
          <p className="mt-8">
            Questions? <a href={`mailto:${profile.reply_to_email}`}>Email {content.founderName}</a>.
          </p>
        )}
      </main>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-10 pt-16 text-[15px] text-muted sm:px-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6">
          <span>Sent with Quillmarc</span>
          <Link href={`/u/${token}/stop`} className="text-muted">
            Stop receiving these updates
          </Link>
          <Link href="/privacy" className="text-muted">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
