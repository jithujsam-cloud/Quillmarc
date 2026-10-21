import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <header className="flex h-16 items-center justify-between gap-4 border-b border-line px-4 sm:px-8">
        <span className="font-medium">{content.companyName}</span>
        <ThemeToggle />
      </header>
      <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-4 pt-12 sm:px-6 sm:pt-16">
        <UpdateDocument content={content} greetingName={firstName(send.investor_name)} warnings={update.metrics_json?.warnings} />
        {profile.reply_to_email && (
          <p className="mt-8">
            <a href={`mailto:${profile.reply_to_email}`} className="btn btn-secondary">
              Reply to {content.founderName}
            </a>
          </p>
        )}
      </main>
      <footer className="mx-auto mt-16 flex w-full max-w-[680px] flex-wrap gap-x-5 gap-y-2 px-4 pb-10 text-[13px] text-faint sm:px-6">
        <span>Sent with Quillmarc</span>
        <Link href={`/u/${token}/stop`} className="text-faint">
          Stop receiving these updates
        </Link>
        <Link href="/privacy" className="text-faint">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
