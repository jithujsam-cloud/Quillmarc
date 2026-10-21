import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { removeInvestor } from "@/lib/actions/setup";
import type { InvestorRow } from "@/lib/db-types";

export const metadata: Metadata = { title: "Investors" };

function state(i: InvestorRow): { label: string; cls: string } | null {
  if (i.opted_out) return { label: "Opted out", cls: "pill" };
  if (i.suppressed) return { label: i.suppressed_reason === "complained" ? "Marked as spam" : "Bounced", cls: "pill pill-neg" };
  return null;
}

// The screen's question: "Who gets my update?"
export default async function InvestorsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("investors").select("*").eq("user_id", user.id).order("name");
  const investors = (data ?? []) as InvestorRow[];
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
                  <th className="n">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {investors.map((i) => {
                  const s = state(i);
                  return (
                    <tr key={i.id}>
                      <td className="min-w-0">
                        <span className="font-medium">{i.name}</span>
                        <span className="sub truncate" title={i.email}>{i.email}</span>
                      </td>
                      <td className="n line2 !text-left">{s ? <span className={s.cls}>{s.label}</span> : <span className="text-faint">Receives updates</span>}</td>
                      <td className="n row-start-1 col-start-2">
                        <form action={removeInvestor}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn btn-ghost btn-sm" aria-label={`Remove ${i.name}`}>
                            Remove
                          </button>
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
