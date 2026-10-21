import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";
import type { UpdateRow } from "@/lib/db-types";
import { monthKey } from "@/lib/db-types";
import { monthLabel } from "@/lib/metrics/present";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Updates" };

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const [setup, { data }] = await Promise.all([
    getSetupState(supabase, user.id),
    supabase.from("updates").select("id, month, status, sent_at, updated_at").eq("user_id", user.id).order("month", { ascending: false }),
  ]);
  const updates = (data ?? []) as Pick<UpdateRow, "id" | "month" | "status" | "sent_at" | "updated_at">[];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Updates</h1>
          {setup.profile?.company_name && <p className="mt-2 text-muted">{setup.profile.company_name}</p>}
        </div>
        {setup.nextStep === null && (
          <Link href="/updates/new" className="btn">
            New update
          </Link>
        )}
      </div>

      {setup.nextStep !== null && (
        <section className="card mt-8 p-6">
          <h2 className="text-2xl">Finish setting up</h2>
          <p className="mt-2 text-muted">Connect Stripe, add your investors and set your sender details. Then you can write your first update.</p>
          <Link href={`/onboarding?step=${setup.nextStep}`} className="btn mt-5">
            Continue setup
          </Link>
        </section>
      )}

      {setup.connection?.status === "error" && (
        <p className="notice mt-6" role="status">
          Stripe: {setup.connection.last_error} <Link href="/settings">Go to Settings</Link>.
        </p>
      )}

      <section className="mt-10" aria-labelledby="list-heading">
        <h2 id="list-heading" className="sr-only">
          All updates
        </h2>
        {updates.length === 0 ? (
          setup.nextStep === null && <p className="text-muted">No updates yet. Start with last month.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {updates.map((u) => (
              <li key={u.id}>
                <Link href={u.status === "draft" ? `/updates/${u.id}/edit` : `/updates/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 py-5 text-ink no-underline hover:bg-tint sm:px-3">
                  <span className="font-display text-2xl">{monthLabel(monthKey(u.month))}</span>
                  <span className="flex items-center gap-3 text-[15px] text-muted">
                    {u.status === "sent" && u.sent_at && <span>Sent {formatDate(u.sent_at)}</span>}
                    <span className={`badge ${u.status === "draft" ? "badge-quiet" : ""}`}>{u.status === "draft" ? "Draft" : u.status === "sending" ? "Sending" : "Sent"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
