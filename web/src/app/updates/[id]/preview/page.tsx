import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateDocument } from "@/components/update/update-document";
import { requireUser } from "@/lib/auth";
import { contentFor } from "@/lib/sending/queue";
import type { ProfileRow, UpdateRow } from "@/lib/db-types";
import { isUuid } from "@/lib/validate";

export const metadata: Metadata = { title: "Preview" };

// What an investor sees on their page. No read is logged here.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase, user } = await requireUser();
  const [{ data: update }, { data: profile }] = await Promise.all([
    supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>(),
    supabase.from("profiles").select("*").eq("id", user.id).single<ProfileRow>(),
  ]);
  if (!update || !profile || !update.metrics_json) notFound();
  const content = contentFor(update, profile);
  const back = update.status === "draft" ? `/updates/${update.id}/edit` : `/updates/${update.id}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-tint px-4 py-3 text-accent-ink sm:px-8">
        <p>Preview of the investor page. No read is logged.</p>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href={back} className="btn btn-secondary btn-sm">
            Back
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <UpdateDocument content={content} greetingName="[first name]" warnings={update.metrics_json.warnings} />
      </main>
    </div>
  );
}
