import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UpdateDocument } from "@/components/update/update-document";
import { SiteFooter } from "@/components/site-footer";
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

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-ink px-4 py-3 text-center text-[15px] text-bg">
        Preview. This is the page each investor sees from their email. No read is logged.{" "}
        <Link href={update.status === "draft" ? `/updates/${update.id}/edit?step=preview` : `/updates/${update.id}`} className="text-bg underline">
          Back
        </Link>
      </div>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-12 sm:px-6">
        <UpdateDocument content={content} greetingName="[first name]" warnings={update.metrics_json.warnings} />
      </main>
      <SiteFooter />
    </div>
  );
}
