import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { requireUser } from "@/lib/auth";
import { removeInvestor } from "@/lib/actions/setup";
import type { InvestorRow } from "@/lib/db-types";

export const metadata: Metadata = { title: "Investors" };

function state(i: InvestorRow) {
  if (i.opted_out) return "Opted out";
  if (i.suppressed) return i.suppressed_reason === "complained" ? "Marked as spam" : "Bounced";
  return null;
}

export default async function InvestorsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("investors").select("*").eq("user_id", user.id).order("name");
  const investors = (data ?? []) as InvestorRow[];

  return (
    <AppShell>
      <h1 className="text-4xl">Investors</h1>
      <p className="mt-2 text-muted">
        <span className="num">{investors.length}</span> {investors.length === 1 ? "person gets" : "people get"} your updates, one email each.
      </p>

      {investors.length > 0 && (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {investors.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium">{i.name}</p>
                <p className="num break-all text-[15px] text-muted">{i.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {state(i) && <span className="badge badge-quiet">{state(i)}</span>}
                <form action={removeInvestor}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="btn btn-secondary btn-sm" aria-label={`Remove ${i.name}`}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint mt-4">Opted-out and bounced investors are never emailed. Removing someone also removes their history.</p>

      <section className="card mt-10 p-5 sm:p-8">
        <h2 className="mb-4 text-2xl">Add investors</h2>
        <InvestorPasteForm />
      </section>
    </AppShell>
  );
}
