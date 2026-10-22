import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { removeInvestor } from "@/lib/actions/setup";
import type { InvestorRow } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { loadInvestorOverview } from "@/lib/investor-data";
import { quietLine } from "@/lib/investor-activity";
import { getTimeZone } from "@/lib/timezone-server";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Investors" };

function state(i: InvestorRow): { label: string; cls: string } | null {
  if (i.opted_out) return { label: "Opted out", cls: "pill" };
  if (i.suppressed) return { label: i.suppressed_reason === "complained" ? "Marked as spam" : "Bounced", cls: "pill pill-neg" };
  return null;
}

// The screen's question: "Who gets my update, and who has stopped reading?"
export default async function InvestorsPage() {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const { investors, activity, quiet } = await loadInvestorOverview(supabase, user.id);
  const blocked = investors.filter((i) => i.opted_out || i.suppressed).length;
  const active = investors.length - blocked;

  return (
    <AppShell crumbs={[{ label: "Investors" }]}>
      <TitleRow
        title="Investors"
        sub={
          investors.length
            ? `${active} ${active === 1 ? "investor gets" : "investors get"} your updates, one email each.${blocked ? ` ${blocked} will not be emailed.` : ""}${quiet.length ? ` ${quiet.length} ${quiet.length === 1 ? "has" : "have"} gone quiet.` : ""}`
            : "Nobody yet. Paste your list to start."
        }
      />

      {quiet.length > 0 && (
        <section className="notice mb-4" aria-labelledby="quiet-h">
          <h2 id="quiet-h" className="sr-only">
            Gone quiet
          </h2>
          <ul className="grid gap-1">
            {quiet.map((q) => (
              <li key={q.id}>
                {quietLine(q.name, q.missed)} <Link href={`/investors/${q.id}`}>See their history</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                  const st = activity.get(i.id);
                  return (
                    <tr key={i.id}>
                      <td className="min-w-0">
                        <Link href={`/investors/${i.id}`} className="row-link">
                          {i.name}
                        </Link>
                        <span className="sub truncate" title={i.email}>{i.email}</span>
                      </td>
                      <td className="n line2 !text-left">{s ? <span className={s.cls}>{s.label}</span> : st?.quiet ? <span className="pill pill-warn">Gone quiet</span> : <span className="text-faint">Receives updates</span>}</td>
                      <td className="n hidden num sm:table-cell">{st?.received ?? 0}</td>
                      <td className="n hidden of sm:table-cell">{st?.received ? `${st.read} of ${st.received}` : <span className="text-faint">-</span>}</td>
                      <td className="n hidden sm:table-cell">{st?.lastReadAt ? formatDate(st.lastReadAt, tz.zone) : <span className="text-faint">-</span>}</td>
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
