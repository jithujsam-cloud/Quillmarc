import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { findByToken } from "@/lib/tracking";
import { confirmOptOut } from "./actions";

export const metadata: Metadata = { title: "Stop receiving updates", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// A confirm button, not a link that acts on load, so mail scanners cannot opt anyone out.
export default async function StopPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const found = await findByToken(adminClient(), token);
  if (!found) notFound();
  const company = found.profile.company_name ?? "this company";
  const { data: inv } = await adminClient().from("investors").select("opted_out").eq("id", found.send.investor_id).maybeSingle();
  const stopped = done === "1" || Boolean(inv?.opted_out);

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 pt-20">
      {stopped ? (
        <div role="status">
          <h1 className="text-4xl">You are unsubscribed</h1>
          <p className="mt-4">You will not get more investor updates from {company} through Quillmarc.</p>
          <p className="mt-4 text-muted">Changed your mind? Reply to any earlier update and ask {found.profile.founder_name ?? "the founder"} to add you back.</p>
        </div>
      ) : (
        <>
          <h1 className="text-4xl">Stop receiving these updates?</h1>
          <p className="mt-4">You will no longer get investor updates from {company}.</p>
          <form action={confirmOptOut} className="mt-8">
            <input type="hidden" name="token" value={token} />
            <button className="btn">Stop receiving updates</button>
          </form>
        </>
      )}
    </main>
  );
}
