import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupPanel } from "@/components/setup-panel";
import { TitleRow } from "@/components/title-row";
import { TrialEndedPanel } from "@/components/trial-notice";
import { requireUser } from "@/lib/auth";
import type { UpdateRow } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { getTimeZone } from "@/lib/timezone-server";
import { defaultPeriod, overlaps, periodFromRow, periodLabel, periodRange, typeLabel } from "@/lib/periods";
import { getSetupState } from "@/lib/setup";
import { accessFor } from "@/lib/trial";

export const metadata: Metadata = { title: "Updates" };

// The screen's question: "What have I sent, and what is due next?"
export default async function UpdatesPage() {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const [setup, { data }, { data: sendData }] = await Promise.all([
    getSetupState(supabase, user.id),
    supabase.from("updates").select("*").eq("user_id", user.id).order("period_end", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("sends").select("update_id, status").eq("user_id", user.id),
  ]);
  const updates = (data ?? []) as UpdateRow[];
  const sent = new Map<string, { delivered: number; all: number }>();
  for (const s of (sendData ?? []) as { update_id: string; status: string }[]) {
    const c = sent.get(s.update_id) ?? { delivered: 0, all: 0 };
    c.all += 1;
    if (s.status === "sent") c.delivered += 1;
    sent.set(s.update_id, c);
  }
  // "Sent to 18 of 24": everyone who got it, out of everyone on the list when it went out.
  const reach = (u: UpdateRow) => {
    const c = sent.get(u.id) ?? { delivered: 0, all: 0 };
    return { delivered: c.delivered, of: u.investor_total ?? c.all };
  };

  const access = accessFor(setup.profile ?? {});
  const due = defaultPeriod("month");
  const dueCovered = updates.some((u) => overlaps(periodFromRow(u), due));
  const lastSent = updates.find((u) => u.status === "sent");

  const finding =
    setup.nextStep !== null
      ? "Finish setup to write your first update."
      : !dueCovered
        ? `Your ${periodLabel(due)} update is not started.`
        : lastSent
          ? `${periodLabel(periodFromRow(lastSent))} went to ${reach(lastSent).delivered} of ${reach(lastSent).of} investors on ${formatDate(lastSent.sent_at, tz.zone)}.`
          : "Your update is a draft. Review the numbers, write a few bullets and send it.";

  const add = access.expired ? (
    <Link href="/settings#plan" className="btn btn-secondary">
      Trial ended
    </Link>
  ) : setup.nextStep !== null ? (
    <Link href={`/onboarding?step=${setup.nextStep}`} className="btn">
      Finish setup
    </Link>
  ) : (
    <Link href="/updates/new" className="btn">
      Add update
    </Link>
  );

  return (
    <AppShell crumbs={[{ label: "Updates" }]}>
      <TitleRow title="Updates" sub={finding} actions={add} />

      {access.expired && (
        <div className="mb-4">
          <TrialEndedPanel access={access} />
        </div>
      )}
      {setup.nextStep !== null && <SetupPanel step={setup.nextStep} />}

      {setup.nextStep === null && updates.length === 0 && (
        <div className="empty mt-0">
          <p>No updates yet. Pick a month, quarter, year or your own dates, and Quillmarc calculates the numbers.</p>
          <Link href="/updates/new" className="btn btn-secondary btn-sm">
            Add your first update
          </Link>
        </div>
      )}

      {updates.length > 0 && (
        <section className="panel" aria-labelledby="all-h">
          <div className="panel-head">
            <h2 id="all-h">All updates</h2>
            <span className="meta">
              {updates.length} {updates.length === 1 ? "update" : "updates"}
            </span>
          </div>
          <table className="table stack">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Sent</th>
                <th className="n">Investors reached</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((u) => {
                const p = periodFromRow(u);
                const r = reach(u);
                const href = u.status === "draft" ? `/updates/${u.id}/edit` : `/updates/${u.id}`;
                const range = periodRange(p);
                return (
                  <tr key={u.id}>
                    <td className="min-w-0">
                      <Link href={href} className="row-link">
                        {periodLabel(p)}
                      </Link>
                      <span className="sub">
                        {typeLabel(p.type)}
                        {periodLabel(p) !== range ? `, ${range}` : ""}
                      </span>
                    </td>
                    <td className="n sm:text-left">
                      <span className={u.status === "draft" ? "pill pill-quiet" : "pill pill-accent"}>{u.status === "draft" ? "Draft" : u.status === "sending" ? "Sending" : "Sent"}</span>
                    </td>
                    <td className="line2 sm:!text-left">{u.sent_at ? formatDate(u.sent_at, tz.zone) : <span className="text-faint" aria-label="Not sent">-</span>}</td>
                    <td className="n num">
                      {u.status === "draft" ? (
                        <span className="text-faint" aria-label="Not sent">
                          -
                        </span>
                      ) : (
                        <>
                          {r.delivered} <span className="text-faint">of {r.of}</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}
