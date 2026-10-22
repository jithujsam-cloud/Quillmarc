import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { removeInvestor } from "@/lib/actions/setup";
import type { InvestorRow } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { getTimeZone } from "@/lib/timezone-server";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Investors" };

function state(i: InvestorRow): { label: string; cls: string } | null {
  if (i.opted_out) return { label: "Opted out", cls: "pill" };
  if (i.suppressed) return { label: i.suppressed_reason === "complained" ? "Marked as spam" : "Bounced", cls: "pill pill-neg" };
  return null;
}

// The screen's question: "Who gets my update?"
export default async function InvestorsPage() {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const [{ data }, { data: sendData }, { data: readData }] = await Promise.all([
    supabase.from("investors").select("*").eq("user_id", user.id).order("name"),
    supabase.from("sends").select("id, investor_id, status").eq("user_id", user.id),
    supabase.from("events").select("send_id, occurred_at").eq("user_id", user.id).eq("type", "read"),
  ]);
  const investors = (data ?? []) as InvestorRow[];
  // Per investor: updates received, updates read, and when they last read one.
  const sendOwner = new Map<string, string>();
  const stats = new Map<string, { received: number; read: Set<string>; last: string | null }>();
  for (const s of (sendData ?? []) as { id: string; investor_id: string; status: string }[]) {
    sendOwner.set(s.id, s.investor_id);
    const c = stats.get(s.investor_id) ?? { received: 0, read: new Set<string>(), last: null };
    if (s.status === "sent") c.received += 1;
    stats.set(s.investor_id, c);
  }
  for (const e of (readData ?? []) as { send_id: string; occurred_at: string }[]) {
    const c = stats.get(sendOwner.get(e.send_id) ?? "");
    if (!c) continue;
    c.read.add(e.send_id);
    if (!c.last || e.occurred_at > c.last) c.last = e.occurred_at;
  }
  const blocked = investors.filter((i) => i.opted_out || i.suppressed).length;
  const active = investors.length - blocked;

  return (
    <AppShell crumbs={[{ label: "Investors" }]}>
      <TitleRow
        title="Investors"
        sub={
          investors.length
            ? `${active} ${active === 1 ? "investor gets" : "investors get"} your updates, one email each.${blocked ? ` ${blocked} will not be emailed.` : ""}`
            : "Nobody yet. Paste your list to start."
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel" aria-labelledby="list-h">
          <div className="panel-head">
            <h2 id="list-h">Your list</h2>
            <span className="meta">{investors.length} total</span>
          </div>
          {investors.length === 0 ? (
            <div className="panel-body">
              <p className="empty">No investors yet. Add them on the right.</p>
            </div>
          ) : (
            <table className="table stack">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Status</th>
                  <th className="n">Received</th>
                  <th className="n">Read</th>
                  <th className="n">Last read</th>
                  <th className="n">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {investors.map((i) => {
                  const s = state(i);
                  const st = stats.get(i.id) ?? { received: 0, read: new Set<string>(), last: null };
                  return (
                    <tr key={i.id}>
                      <td className="min-w-0">
                        <span className="font-medium">{i.name}</span>
                        <span className="sub truncate" title={i.email}>{i.email}</span>
                      </td>
                      <td className="n line2 !text-left">{s ? <span className={s.cls}>{s.label}</span> : <span className="text-faint">Receives updates</span>}</td>
                      <td className="n hidden num sm:table-cell">{st.received}</td>
                      <td className="n hidden num sm:table-cell">{st.received ? `${st.read.size} of ${st.received}` : <span className="text-faint">-</span>}</td>
                      <td className="n hidden sm:table-cell">{st.last ? formatDate(st.last, tz.zone) : <span className="text-faint">-</span>}</td>
                      <td className="n row-start-1 col-start-2">
                        <form action={removeInvestor}>
                          <input type="hidden" name="id" value={i.id} />
                          <SubmitButton className="btn btn-ghost btn-sm" aria-label={`Remove ${i.name}`} pendingLabel="Removing">
                            Remove
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel panel-pad" aria-labelledby="add-h">
          <h2 id="add-h" className="mb-1">
            Add investors
          </h2>
          <p className="hint mb-4">Duplicates are skipped. Opted-out and bounced addresses are never emailed again.</p>
          <InvestorPasteForm />
        </section>
      </div>
    </AppShell>
  );
}
