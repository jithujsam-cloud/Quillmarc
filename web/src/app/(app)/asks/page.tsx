import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { deleteAsk, setAskStatus } from "@/lib/actions/asks";
import { ASK_STATUS_LABELS, type AskRow, type AskStatus, type InvestorRow } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { getTimeZone } from "@/lib/timezone-server";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Asks" };

const NEXT: Record<AskStatus, { status: AskStatus; label: string }[]> = {
  open: [
    { status: "intro_made", label: "Intro made" },
    { status: "done", label: "Mark done" },
  ],
  intro_made: [
    { status: "done", label: "Mark done" },
    { status: "open", label: "Reopen" },
  ],
  done: [{ status: "open", label: "Reopen" }],
};

// The screen's question: "What am I still waiting on from my investors?"
export default async function AsksPage() {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const [{ data }, { data: inv }] = await Promise.all([
    supabase.from("asks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("investors").select("id, name").eq("user_id", user.id).order("name"),
  ]);
  const asks = (data ?? []) as AskRow[];
  const investors = (inv ?? []) as Pick<InvestorRow, "id" | "name">[];
  const nameOf = new Map(investors.map((i) => [i.id, i.name]));
  const open = asks.filter((a) => a.status !== "done");
  const done = asks.filter((a) => a.status === "done");

  return (
    <AppShell crumbs={[{ label: "Asks" }]}>
      <TitleRow
        title="Asks"
        sub={asks.length ? `${open.length} open ${open.length === 1 ? "ask" : "asks"}. Open asks go into your next update draft, so you never forget one.` : "Nothing yet. Add what you want from your investors, like an intro or feedback."}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <section className="panel" aria-labelledby="open-h">
            <div className="panel-head">
              <h2 id="open-h">Open</h2>
              <span className="meta">{open.length}</span>
            </div>
            {open.length === 0 ? (
              <div className="panel-body">
                <p className="empty">No open asks.</p>
              </div>
            ) : (
              <ul>
                {open.map((a) => (
                  <AskItem key={a.id} ask={a} who={a.investor_id ? nameOf.get(a.investor_id) : undefined} tz={tz.zone} />
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="panel" aria-labelledby="done-h">
              <div className="panel-head">
                <h2 id="done-h">Done</h2>
                <span className="meta">{done.length}</span>
              </div>
              <ul>
                {done.map((a) => (
                  <AskItem key={a.id} ask={a} who={a.investor_id ? nameOf.get(a.investor_id) : undefined} tz={tz.zone} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="panel panel-pad" aria-labelledby="add-h">
          <h2 id="add-h" className="mb-4">
            Add an ask
          </h2>
          <AskForm investors={investors} />
        </section>
      </div>
    </AppShell>
  );
}

function AskItem({ ask, who, tz }: { ask: AskRow; who?: string; tz: string }) {
  return (
    <li className="border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 ${ask.status === "done" ? "text-muted" : ""}`}>{ask.text}</p>
        <span className={ask.status === "done" ? "pill pill-pos" : ask.status === "intro_made" ? "pill pill-accent" : "pill"}>{ASK_STATUS_LABELS[ask.status]}</span>
      </div>
      <p className="meta mt-1">
        {who && ask.investor_id ? (
          <>
            For <Link href={`/investors/${ask.investor_id}`}>{who}</Link>.{" "}
          </>
        ) : (
          "For anyone. "
        )}
        Handled by {ask.owner ?? "you"}. {ask.status === "done" && ask.resolved_at ? `Done ${formatDate(ask.resolved_at, tz)}.` : `Added ${formatDate(ask.created_at, tz)}.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {NEXT[ask.status].map((n) => (
          <form key={n.status} action={setAskStatus}>
            <input type="hidden" name="id" value={ask.id} />
            <input type="hidden" name="status" value={n.status} />
            <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Saving">
              {n.label}
            </SubmitButton>
          </form>
        ))}
        <form action={deleteAsk}>
          <input type="hidden" name="id" value={ask.id} />
          <SubmitButton className="btn btn-ghost btn-sm" aria-label={`Remove ask: ${ask.text.slice(0, 40)}`} pendingLabel="Removing">
            Remove
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
