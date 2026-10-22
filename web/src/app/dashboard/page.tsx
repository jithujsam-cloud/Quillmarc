import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ReadStrip } from "@/components/read-strip";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";
import type { UpdateRow } from "@/lib/db-types";
import { monthKey } from "@/lib/db-types";
import { figures, headlineFigures, monthLabel } from "@/lib/metrics/present";
import { defaultMonth } from "@/lib/months";
import { formatDate } from "@/lib/format";
import { loadSendStatuses } from "@/lib/status-data";
import { accessFor } from "@/lib/trial";
import { TrialEndedPanel, continueHref } from "@/components/trial-notice";

export const metadata: Metadata = { title: "Updates" };

// The screen's question: "Is this month's update out, and who read the last one?"
export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const [setup, { data }, { data: sendData }, { data: readData }] = await Promise.all([
    getSetupState(supabase, user.id),
    supabase.from("updates").select("*").eq("user_id", user.id).order("month", { ascending: false }),
    supabase.from("sends").select("id, update_id").eq("user_id", user.id),
    supabase.from("events").select("send_id").eq("user_id", user.id).eq("type", "read"),
  ]);
  const updates = (data ?? []) as UpdateRow[];
  const sends = (sendData ?? []) as { id: string; update_id: string }[];
  const readSends = new Set((readData ?? []).map((r) => r.send_id as string));
  const counts = (id: string) => {
    const mine = sends.filter((s) => s.update_id === id);
    return { recipients: mine.length, read: mine.filter((s) => readSends.has(s.id)).length };
  };

  const due = defaultMonth();
  const dueUpdate = updates.find((u) => monthKey(u.month) === due);
  const latest = updates[0];
  const latestSent = updates.find((u) => u.status !== "draft");
  const statuses = latestSent ? await loadSendStatuses(supabase, latestSent.id) : null;

  const access = accessFor(setup.profile ?? {});
  const primary = access.expired ? (
    <a href={continueHref()} className="btn no-underline">
      Continue with Quillmarc
    </a>
  ) : setup.nextStep !== null ? (
      <Link href={`/onboarding?step=${setup.nextStep}`} className="btn">
        Finish setup
      </Link>
    ) : dueUpdate?.status === "draft" ? (
      <Link href={`/updates/${dueUpdate.id}/edit`} className="btn">
        Continue {monthLabel(due).split(" ")[0]} draft
      </Link>
    ) : (
      <Link href="/updates/new" className="btn">
        {dueUpdate ? "New update" : `Write ${monthLabel(due).split(" ")[0]} update`}
      </Link>
    );

  // The finding: the one fact that most needs attention, in words.
  const finding =
    setup.nextStep !== null
      ? "Finish setup to write your first update."
      : !dueUpdate
        ? `Your ${monthLabel(due)} update is not started.`
        : dueUpdate.status === "draft"
          ? `Your ${monthLabel(due)} update is a draft.${statuses && latestSent ? ` ${statuses.totals.read} of ${statuses.totals.recipients} read ${monthLabel(monthKey(latestSent.month)).split(" ")[0]}'s.` : ""}`
          : statuses
            ? `${monthLabel(monthKey(latestSent!.month))}: ${statuses.totals.read} of ${statuses.totals.recipients} investors read it.`
            : `Your ${monthLabel(due)} update is sent.`;

  return (
    <AppShell crumbs={[{ label: "Updates" }]}>
      <TitleRow title="Updates" sub={finding} actions={primary} />

      {setup.connection?.status === "error" && (
        <p className="notice mb-6" role="status">
          Stripe: {setup.connection.last_error} <Link href="/settings#stripe">Open settings</Link>
        </p>
      )}

      {access.expired && (
        <div className="mb-6">
          <TrialEndedPanel access={access} />
        </div>
      )}

      {setup.nextStep !== null && <SetupPanel step={setup.nextStep} />}

      {latest && setup.nextStep === null && (
        <section className="panel" aria-labelledby="latest-h">
          <div className="panel-head">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="latest-h">{monthLabel(monthKey(latest.month))}</h2>
              <StatusPill u={latest} />
              {latest.metrics_json?.sample && <span className="pill pill-warn">Sample data</span>}
            </div>
            <Link href={latest.status === "draft" ? `/updates/${latest.id}/edit` : `/updates/${latest.id}`} className="card-link">
              {latest.status === "draft" ? "Open draft" : "See who read it"}
            </Link>
          </div>
          {latest.metrics_json && (
            <div className="kpis border-y border-line">
              {headlineFigures(figures(latest.metrics_json, latest.adjustments_json)).map((f, i) => (
                <div key={f.key} className={`kpi ${i === 0 ? "kpi-lead" : ""}`}>
                  <p className="kpi-label">{f.label}</p>
                  <p className="kpi-value">{f.display}</p>
                  <p className="kpi-sub">{f.adjusted ? "Adjusted by founder" : f.estimated ? "Estimated" : "From Stripe"}</p>
                </div>
              ))}
            </div>
          )}
          {latestSent?.id === latest.id && statuses ? (
            <div className="panel-body pt-5">
              <p className="mb-3 text-muted">
                {statuses.totals.read} of {statuses.totals.recipients} read · sent {formatDate(latest.sent_at)}
              </p>
              <ReadStrip statuses={statuses.rows.map((r) => r.derived.status)} names={statuses.rows.map((r) => r.send.investor_name)} />
            </div>
          ) : (
            <p className="panel-body pt-5 text-muted">
              {latest.status === "draft" ? "Not sent yet. Review the numbers, write your bullets, send a test, then send." : ""}
            </p>
          )}
        </section>
      )}

      {latestSent && latest && latestSent.id !== latest.id && statuses && setup.nextStep === null && (
        <section className="panel mt-6" aria-labelledby="last-h">
          <div className="panel-head">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="last-h">{monthLabel(monthKey(latestSent.month))}</h2>
              <span className="pill pill-accent">Sent</span>
              <span className="meta">{formatDate(latestSent.sent_at)}</span>
            </div>
            <Link href={`/updates/${latestSent.id}`} className="card-link">
              See who read it
            </Link>
          </div>
          <div className="panel-body">
            <p className="mb-3 text-muted">
              {statuses.totals.read} of {statuses.totals.recipients} investors read it.
            </p>
            <ReadStrip statuses={statuses.rows.map((r) => r.derived.status)} names={statuses.rows.map((r) => r.send.investor_name)} />
          </div>
        </section>
      )}

      {setup.nextStep === null && !latest && (
        <div className="empty mt-0">
          <p>No updates yet. Your first one takes about ten minutes.</p>
          <Link href="/updates/new" className="btn btn-secondary btn-sm">
            Write {monthLabel(due)}
          </Link>
        </div>
      )}

      {updates.length > 0 && (
        <section className="panel mt-6" aria-labelledby="all-h">
          <div className="panel-head">
            <h2 id="all-h">All updates</h2>
            <span className="meta">
              {updates.length} {updates.length === 1 ? "update" : "updates"}
            </span>
          </div>
          <table className="table stack">
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th className="n">Sent</th>
                <th className="n">Recipients</th>
                <th className="n">Read</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((u) => {
                const c = counts(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={u.status === "draft" ? `/updates/${u.id}/edit` : `/updates/${u.id}`} className="row-link">
                        {monthLabel(monthKey(u.month))}
                      </Link>
                    </td>
                    <td className="n sm:text-left">
                      <StatusPill u={u} />
                    </td>
                    <td className="n line2 sm:text-right">{u.sent_at ? formatDate(u.sent_at) : <span className="text-faint" aria-label="Not sent">-</span>}</td>
                    <td className="n hidden sm:table-cell">{u.status === "draft" ? <span className="text-faint">-</span> : c.recipients}</td>
                    <td className="n hidden sm:table-cell">{u.status === "draft" ? <span className="text-faint">-</span> : `${c.read} of ${c.recipients}`}</td>
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

function StatusPill({ u }: { u: Pick<UpdateRow, "status"> }) {
  if (u.status === "draft") return <span className="pill pill-quiet">Draft</span>;
  if (u.status === "sending") return <span className="pill pill-accent">Sending</span>;
  return <span className="pill pill-accent">Sent</span>;
}

function SetupPanel({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Connect Stripe", "Add investors", "Sender details"];
  const done = step - 1;
  return (
    <section className="panel panel-pad" aria-labelledby="setup-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setup-h">Set up Quillmarc</h2>
        <span className="meta">
          {done} of 3 done
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={done} aria-label="Setup progress">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(done / 3) * 100}%` }} />
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-lg p-4 ${i + 1 === step ? "bg-tint text-accent-ink" : "bg-raised text-muted"}`}>
            <p className="font-medium">{s}</p>
            <p className="mt-1 text-[13px]">{i + 1 < step ? "Done" : i + 1 === step ? "Next" : "Later"}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
