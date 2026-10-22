import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { ASK_STATUS_LABELS, type AskRow, type EventRow, type InvestorRow, type SendRow, type UpdateRow } from "@/lib/db-types";
import { formatDateTime } from "@/lib/format";
import { activityFor, quietLine, type InvestorSend } from "@/lib/investor-activity";
import { periodFromRow, periodLabel, periodRange, typeLabel } from "@/lib/periods";
import { deriveStatus, STATUS_LABELS, type DisplayStatus } from "@/lib/sending/status";
import { getTimeZone } from "@/lib/timezone-server";
import { isUuid } from "@/lib/validate";

export const metadata: Metadata = { title: "Investor" };

const PILL: Partial<Record<DisplayStatus, string>> = {
  read: "pill pill-accent",
  opened: "pill",
  delivered: "pill pill-quiet",
  bounced: "pill pill-neg",
  complained: "pill pill-neg",
  failed: "pill pill-neg",
};

// The screen's question: "What has this investor done with my updates?"
export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireUser();
  const tz = await getTimeZone();
  const { data: investor } = await supabase.from("investors").select("*").eq("id", id).maybeSingle<InvestorRow>();
  if (!investor) notFound();

  const { data: sendData } = await supabase.from("sends").select("*").eq("investor_id", id);
  const sends = (sendData ?? []) as SendRow[];
  const updateIds = [...new Set(sends.map((s) => s.update_id))];
  const [{ data: updateData }, { data: eventData }, { data: askData }] = await Promise.all([
    updateIds.length ? supabase.from("updates").select("*").in("id", updateIds) : Promise.resolve({ data: [] }),
    sends.length ? supabase.from("events").select("send_id, type, occurred_at").in("send_id", sends.map((s) => s.id)) : Promise.resolve({ data: [] }),
    supabase.from("asks").select("*").eq("investor_id", id).order("created_at", { ascending: false }),
  ]);
  const updates = new Map(((updateData ?? []) as UpdateRow[]).map((u) => [u.id, u]));
  const events = (eventData ?? []) as Pick<EventRow, "send_id" | "type" | "occurred_at">[];
  const asks = (askData ?? []) as AskRow[];

  const first = (sendId: string, type: string) => events.filter((e) => e.send_id === sendId && e.type === type).map((e) => e.occurred_at).sort()[0] ?? null;
  const rows = sends
    .map((s) => {
      const u = updates.get(s.update_id);
      const ev = events.filter((e) => e.send_id === s.id).map((e) => ({ type: e.type, occurredAt: e.occurred_at }));
      const derived = deriveStatus({ sendStatus: s.status, sentAt: s.sent_at, createdAt: s.created_at, events: ev, investorOptedOut: investor.opted_out });
      return { s, u, derived, delivered: first(s.id, "delivered"), opened: first(s.id, "opened"), read: first(s.id, "read") };
    })
    .filter((r) => r.u)
    .sort((a, b) => ((a.u?.sent_at ?? a.s.created_at) < (b.u?.sent_at ?? b.s.created_at) ? 1 : -1));

  const activity = activityFor(
    rows.map<InvestorSend>((r) => ({ updateId: r.s.update_id, sentAt: r.u?.sent_at ?? r.s.created_at, delivered: r.s.status === "sent", readAt: r.read })),
  );
  const blocked = investor.opted_out ? "Opted out" : investor.suppressed ? (investor.suppressed_reason === "complained" ? "Marked as spam" : "Bounced") : null;
  const dash = <span className="text-faint">-</span>;
  const when = (iso: string | null) => (iso ? formatDateTime(iso, tz.zone) : dash);

  return (
    <AppShell crumbs={[{ label: "Investors", href: "/investors" }, { label: investor.name }]}>
      <TitleRow
        title={investor.name}
        sub={
          <>
            {investor.email}. {activity.received ? `${activity.read} of ${activity.received} updates read.` : "No updates sent to them yet."}
            {blocked ? ` ${blocked}, so they are not emailed.` : ""}
          </>
        }
      />

      {activity.quiet && !blocked && <p className="notice mb-4">{quietLine(investor.name.split(" ")[0], activity.missedInARow)}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel" aria-labelledby="hist-h">
          <div className="panel-head">
            <h2 id="hist-h">Updates sent to them</h2>
            <span className="meta">Newest first</span>
          </div>
          {rows.length === 0 ? (
            <div className="panel-body">
              <p className="empty">Nothing sent to {investor.name.split(" ")[0]} yet.</p>
            </div>
          ) : (
            <table className="table stack">
              <thead>
                <tr>
                  <th>Update</th>
                  <th>Delivered</th>
                  <th>Opened</th>
                  <th>Read</th>
                  <th className="n">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, u, derived, delivered, opened, read }) => {
                  const p = periodFromRow(u as UpdateRow);
                  return (
                    <tr key={s.id}>
                      <td className="min-w-0">
                        <Link href={`/updates/${s.update_id}`} className="row-link">
                          {periodLabel(p)}
                        </Link>
                        <span className="sub">
                          {typeLabel(p.type)}, {periodRange(p)}
                        </span>
                      </td>
                      <td className="line2 hidden sm:table-cell">{when(delivered)}</td>
                      <td className="line2 hidden sm:table-cell">{when(opened)}</td>
                      <td className="line2 sm:!text-left">{read ? when(read) : <span className="text-faint">Not read</span>}</td>
                      <td className="n row-start-1 col-start-2">
                        <span className={derived.possiblyAutomatic ? "pill pill-quiet" : (PILL[derived.status] ?? "pill")}>{derived.status === "opened" && derived.possiblyAutomatic ? "Opened, possibly automatic" : STATUS_LABELS[derived.status]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel" aria-labelledby="asks-h">
          <div className="panel-head">
            <h2 id="asks-h">Asks for {investor.name.split(" ")[0]}</h2>
            <Link href="/asks" className="card-link">
              All asks
            </Link>
          </div>
          <div className="panel-body">
            {asks.length === 0 ? (
              <p className="text-muted">No asks name them. Add one on the Asks page.</p>
            ) : (
              <ul className="grid gap-3">
                {asks.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3">
                    <span>{a.text}</span>
                    <span className={a.status === "done" ? "pill pill-pos" : a.status === "intro_made" ? "pill pill-accent" : "pill"}>{ASK_STATUS_LABELS[a.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
