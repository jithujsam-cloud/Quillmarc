import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { TitleRow } from "@/components/title-row";
import { requireAdmin } from "@/lib/admin";
import type { ProfileRow } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { adminClient } from "@/lib/supabase/admin";
import { accessFor, trialLabel } from "@/lib/trial";
import { setAccess } from "./actions";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

// The owner's view of every account: who is on a trial, who is active, and how far each got.
export default async function AdminPage() {
  await requireAdmin();
  const admin = adminClient();
  const [{ data: profiles }, { data: conns }, { data: inv }, { data: ups }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("stripe_connections").select("user_id, method, key_mode, status"),
    admin.from("investors").select("user_id"),
    admin.from("updates").select("user_id, status"),
  ]);
  const rows = (profiles ?? []) as ProfileRow[];
  const count = <T extends { user_id: string }>(list: T[] | null, id: string, f: (x: T) => boolean = () => true) => (list ?? []).filter((x) => x.user_id === id && f(x)).length;
  const onTrial = rows.filter((p) => accessFor(p).plan === "trial" && !accessFor(p).expired).length;
  const active = rows.filter((p) => p.plan === "active").length;

  return (
    <AppShell crumbs={[{ label: "Accounts" }]}>
      <TitleRow title="Accounts" sub={`${rows.length} accounts. ${active} active, ${onTrial} on a trial.`} />
      <section className="panel" aria-labelledby="acc-h">
        <div className="panel-head">
          <h2 id="acc-h">Every account</h2>
          <span className="meta">Only emails in ADMIN_EMAILS can see this page</span>
        </div>
        <table className="table stack">
          <thead>
            <tr>
              <th>Founder</th>
              <th>Plan</th>
              <th>Stripe</th>
              <th className="n">Investors</th>
              <th className="n">Sent</th>
              <th className="n">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const a = accessFor(p);
              const conn = (conns ?? []).find((c) => c.user_id === p.id);
              return (
                <tr key={p.id}>
                  <td className="min-w-0">
                    <span className="font-medium">{p.company_name ?? "No company yet"}</span>
                    <span className="sub truncate" title={p.email}>
                      {p.founder_name ? `${p.founder_name}, ` : ""}
                      {p.email}
                    </span>
                    <span className="sub">Joined {formatDate(p.created_at)}</span>
                  </td>
                  <td className="n !text-right sm:!text-left">
                    <span className={`pill ${a.expired ? "pill-warn" : a.plan === "active" ? "pill-pos" : "pill-accent"}`}>{trialLabel(a)}</span>
                  </td>
                  <td className="line2 text-muted">{conn ? `${conn.method === "sample" ? "Sample" : conn.method === "oauth" ? "Connect" : "Key"}${conn.key_mode === "test" ? ", test" : conn.key_mode === "live" ? ", live" : ""}${conn.status === "error" ? ", error" : ""}` : "Not connected"}</td>
                  <td className="n hidden sm:table-cell">{count(inv, p.id)}</td>
                  <td className="n hidden sm:table-cell">{count(ups, p.id, (u: { user_id: string; status: string }) => u.status === "sent")}</td>
                  <td className="n line2 sm:!text-right">
                    <form action={setAccess} className="flex flex-wrap justify-end gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      {p.plan !== "active" && (
                        <SubmitButton className="btn btn-secondary btn-sm" name="action" value="activate">
                          Activate
                        </SubmitButton>
                      )}
                      <SubmitButton className="btn btn-ghost btn-sm" name="action" value="extend">
                        Add 14 days
                      </SubmitButton>
                      {p.plan !== "ended" && (
                        <SubmitButton className="btn btn-ghost btn-sm" name="action" value="end">
                          End access
                        </SubmitButton>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
