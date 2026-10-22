import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReadStrip } from "@/components/read-strip";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import type { UpdateRow } from "@/lib/db-types";
import { monthKey } from "@/lib/db-types";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { monthLabel } from "@/lib/metrics/present";
import { STATUS_LABELS, type DisplayStatus } from "@/lib/sending/status";
import { loadSendStatuses } from "@/lib/status-data";
import { isUuid } from "@/lib/validate";
import { QueueRunner } from "./queue-runner";
import { simulate } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Who read it" };

const PILL: Partial<Record<DisplayStatus, string>> = {
  read: "pill pill-accent",
  opened: "pill",
  delivered: "pill pill-quiet",
  bounced: "pill pill-neg",
  complained: "pill pill-neg",
  failed: "pill pill-neg",
};

// The screen's question: "Who has read it?"
export default async function UpdateStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireUser();
  const { data: update } = await supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>();
  if (!update) notFound();
  if (update.status === "draft") redirect(`/updates/${id}/edit`);

  const { rows, totals: t } = await loadSendStatuses(supabase, id);
  const pending = t.queued > 0;
  const mock = env.emailProvider() === "mock";
  const month = monthLabel(monthKey(update.month));
  const problems = [
    t.bounced && `${t.bounced} bounced`,
    t.complained && `${t.complained} marked it as spam`,
    t.optedOut && `${t.optedOut} opted out`,
    t.failed && `${t.failed} failed to send`,
  ].filter(Boolean) as string[];

  const sub = pending
    ? `Sending. ${t.queued} still in the queue. You can leave this page; sending continues when you come back.`
    : `${t.read} of ${t.recipients} read it.${problems.length ? ` ${problems.join(", ")}.` : ""} Sent ${formatDateTime(update.sent_at)}.`;

  return (
    <AppShell
      crumbs={[{ label: "Updates", href: "/dashboard" }, { label: month }]}
      actions={
        <Link href={`/updates/${id}/preview`} className="btn btn-secondary btn-sm">
          See the update
        </Link>
      }
    >
      <QueueRunner id={id} pending={pending} />
      <TitleRow title={`${month} update`} sub={<span aria-live="polite">{sub}</span>} />

      {pending && (
        <div className="panel panel-pad mb-6" role="status">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Sending</p>
            <p className="text-muted">
              {t.recipients - t.queued} of {t.recipients}
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Emails sent" aria-valuemin={0} aria-valuemax={t.recipients} aria-valuenow={t.recipients - t.queued}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${t.recipients ? ((t.recipients - t.queued) / t.recipients) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {mock && (
        <div className="notice mb-6 flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong>Mock email mode.</strong> No email left this server. Simulate delivery events to try the table.
          </p>
          <form action={simulate}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Simulating">
              Simulate events
            </SubmitButton>
          </form>
        </div>
      )}

      <section className="panel" aria-labelledby="reach-h">
        <h2 id="reach-h" className="sr-only">
          Reach
        </h2>
        <dl className="kpis border-b border-line">
          <div className="kpi kpi-lead">
            <dt className="kpi-label">Read</dt>
            <dd className="kpi-value">
              {t.read} <span className="text-[16px] font-normal text-faint">of {t.recipients}</span>
            </dd>
            <dd className="kpi-sub">Opened the update page</dd>
          </div>
          <div className="kpi">
            <dt className="kpi-label">Opened</dt>
            <dd className="kpi-value">{t.opened}</dd>
            <dd className="kpi-sub">{t.openedPossiblyAutomatic ? `${t.openedPossiblyAutomatic} possibly automatic` : "Opened the email"}</dd>
          </div>
          <div className="kpi">
            <dt className="kpi-label">Delivered</dt>
            <dd className="kpi-value">{t.delivered}</dd>
            <dd className="kpi-sub">Reached the inbox</dd>
          </div>
          <div className="kpi">
            <dt className="kpi-label">Recipients</dt>
            <dd className="kpi-value">{t.recipients}</dd>
            <dd className="kpi-sub">One email each</dd>
          </div>
        </dl>
        <div className="panel-body pt-5">
          <ReadStrip statuses={rows.map((r) => r.derived.status)} names={rows.map((r) => r.send.investor_name)} />
          <p className="hint mt-4 max-w-2xl">Some email apps open messages automatically, so opens are an estimate. Reads on the update page are more reliable.</p>
        </div>
      </section>

      <section className="panel mt-6" aria-labelledby="who-h">
        <div className="panel-head">
          <h2 id="who-h">Each investor</h2>
          <span className="meta">Updates on its own as events arrive</span>
        </div>
        <table className="table stack">
          <caption className="sr-only">Status for each investor</caption>
          <thead>
            <tr>
              <th>Investor</th>
              <th>Status</th>
              <th className="n">Last event</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ send, derived }) => (
              <tr key={send.id}>
                <td className="min-w-0">
                  <span className="font-medium">{send.investor_name}</span>
                  <span className="sub truncate" title={send.investor_email}>{send.investor_email}</span>
                </td>
                <td className="n !text-right sm:!text-left">
                  <span className={derived.possiblyAutomatic ? "pill pill-quiet" : PILL[derived.status] ?? "pill"}>
                    {derived.status === "opened" && derived.possiblyAutomatic ? "Opened, possibly automatic" : STATUS_LABELS[derived.status]}
                  </span>
                  {derived.delayed && <span className="sub">Delivery delayed</span>}
                  {send.status === "failed" && send.last_error && <span className="sub">{send.last_error}</span>}
                </td>
                <td className="n line2 sm:!text-right">{formatDateTime(derived.lastEventAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
