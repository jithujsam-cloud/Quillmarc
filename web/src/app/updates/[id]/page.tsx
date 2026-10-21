import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import type { EventRow, SendRow, UpdateRow } from "@/lib/db-types";
import { monthKey } from "@/lib/db-types";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { monthLabel } from "@/lib/metrics/present";
import { deriveStatus, STATUS_LABELS, totals, type DisplayStatus } from "@/lib/sending/status";
import { isUuid } from "@/lib/validate";
import { QueueRunner } from "./queue-runner";
import { simulate } from "./actions";

export const metadata: Metadata = { title: "Update status" };

const TONE: Partial<Record<DisplayStatus, string>> = {
  read: "border-ok text-ok",
  bounced: "border-error text-error",
  complained: "border-error text-error",
  failed: "border-error text-error",
};

export default async function UpdateStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireUser();
  const { data: update } = await supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>();
  if (!update) notFound();
  if (update.status === "draft") redirect(`/updates/${id}/edit`);

  const { data: sendData } = await supabase.from("sends").select("*, investors(opted_out)").eq("update_id", id).order("investor_name");
  const sends = (sendData ?? []) as (SendRow & { investors: { opted_out: boolean } | null })[];
  const { data: eventData } = sends.length
    ? await supabase.from("events").select("send_id, type, occurred_at").in("send_id", sends.map((s) => s.id))
    : { data: [] };
  const events = (eventData ?? []) as Pick<EventRow, "send_id" | "type" | "occurred_at">[];

  const rows = sends.map((s) => {
    const ev = events.filter((e) => e.send_id === s.id).map((e) => ({ type: e.type, occurredAt: e.occurred_at }));
    const derived = deriveStatus({ sendStatus: s.status, sentAt: s.sent_at, createdAt: s.created_at, events: ev, investorOptedOut: Boolean(s.investors?.opted_out) });
    return { send: s, events: ev, derived, sendStatus: s.status };
  });
  const t = totals(rows);
  const pending = t.queued > 0;
  const mock = env.emailProvider() === "mock";

  const tiles = [
    { label: "Recipients", value: t.recipients },
    { label: "Delivered", value: t.delivered },
    { label: "Opened", value: t.opened, sub: t.openedPossiblyAutomatic ? `${t.openedPossiblyAutomatic} possibly automatic` : undefined },
    { label: "Read", value: t.read },
  ];
  const problems = [
    t.bounced && `${t.bounced} bounced`,
    t.complained && `${t.complained} marked as spam`,
    t.optedOut && `${t.optedOut} opted out`,
    t.failed && `${t.failed} failed to send`,
  ].filter(Boolean);

  return (
    <AppShell width="wide">
      <QueueRunner id={id} pending={pending} />
      <p className="hint">
        <Link href="/dashboard">Updates</Link> / {update.status === "sent" ? "Sent" : "Sending"}
      </p>
      <h1 className="mt-2 text-4xl">{monthLabel(monthKey(update.month))}</h1>
      <p className="mt-2 text-muted" aria-live="polite">
        {pending ? `Sending. ${t.queued} still in the queue. Keep this page open or come back later.` : update.sent_at ? `Sent ${formatDateTime(update.sent_at)}.` : ""}{" "}
        <Link href={`/updates/${id}/preview`}>See the update</Link>
      </p>

      {mock && (
        <div className="notice mt-6 flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong>Mock email mode.</strong> No email left this server. You can simulate delivery events to try the table.
          </p>
          <form action={simulate}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-secondary btn-sm">Simulate events</button>
          </form>
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="card p-4">
            <dt className="text-[15px] text-muted">{x.label}</dt>
            <dd className="num mt-1 text-3xl">{x.value}</dd>
            {x.sub && <dd className="mt-1 text-[14px] text-muted">{x.sub}</dd>}
          </div>
        ))}
      </dl>
      <p className="hint mt-3 max-w-2xl">
        Some email apps open messages automatically, so opens are an estimate. Reads on the update page are more reliable.
      </p>
      {problems.length > 0 && <p className="mt-3">{problems.join(". ")}.</p>}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
          <caption className="sr-only">Status for each investor</caption>
          <thead>
            <tr className="border-b border-line text-[15px] text-muted">
              <th scope="col" className="py-3 pr-3 font-medium">
                Investor
              </th>
              <th scope="col" className="py-3 pr-3 font-medium">
                Status
              </th>
              <th scope="col" className="py-3 font-medium">
                Last event
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ send, derived }) => (
              <tr key={send.id} className="border-b border-line align-top">
                <td className="py-4 pr-3">
                  <span className="block">{send.investor_name}</span>
                  <span className="num block break-all text-[14px] text-muted">{send.investor_email}</span>
                </td>
                <td className="py-4 pr-3">
                  <span className={`badge ${derived.possiblyAutomatic ? "badge-quiet" : TONE[derived.status] ?? ""}`}>
                    {derived.status === "opened" && derived.possiblyAutomatic ? "Opened, possibly automatic" : STATUS_LABELS[derived.status]}
                  </span>
                  {derived.delayed && <span className="mt-1 block text-[14px] text-muted">Delivery delayed</span>}
                  {send.status === "failed" && send.last_error && <span className="mt-1 block text-[14px] text-muted">{send.last_error}</span>}
                </td>
                <td className="num py-4 text-[14px] text-muted">{formatDateTime(derived.lastEventAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
