import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { deleteDraft, recalculate } from "@/lib/actions/updates";
import type { InvestorRow, ProfileRow, StripeConnectionRow, UpdateRow } from "@/lib/db-types";
import { renderUpdateEmail } from "@/lib/email/render";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { EDITABLE_KEYS, figures, MONEY_KEYS, minorUnitFactor, type EditableKey } from "@/lib/metrics/present";
import { contentFor } from "@/lib/sending/queue";
import { isUuid } from "@/lib/validate";
import { BulletsForm } from "./bullets-form";
import { MetricsForm, type EditableFigure } from "./metrics-form";
import { RecipientsForm, type RecipientOption } from "./recipients-form";
import { SendPanel } from "./send-panel";

export const metadata: Metadata = { title: "Edit update" };

const STEPS = [
  { key: "metrics", label: "Numbers" },
  { key: "bullets", label: "Bullets" },
  { key: "preview", label: "Preview" },
  { key: "recipients", label: "Recipients" },
  { key: "send", label: "Send" },
] as const;
type Step = (typeof STEPS)[number]["key"];

export default async function EditUpdatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const { supabase, user } = await requireUser();
  const [{ data: update }, { data: profile }, { data: inv }, { data: conn }] = await Promise.all([
    supabase.from("updates").select("*").eq("id", id).maybeSingle<UpdateRow>(),
    supabase.from("profiles").select("*").eq("id", user.id).single<ProfileRow>(),
    supabase.from("investors").select("*").eq("user_id", user.id).order("name"),
    supabase.from("stripe_connections").select("method, status, last_checked_at").eq("user_id", user.id).maybeSingle<Pick<StripeConnectionRow, "method" | "status" | "last_checked_at">>(),
  ]);
  if (!update || !profile) notFound();
  if (update.status !== "draft") redirect(`/updates/${update.id}`);
  const step: Step = STEPS.some((s) => s.key === sp.step) ? (sp.step as Step) : "metrics";
  const m = update.metrics_json;
  const content = contentFor(update, profile);
  const investors = (inv ?? []) as InvestorRow[];

  const recipients: RecipientOption[] = investors.map((i) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    blocked: i.opted_out ? "Opted out" : i.suppressed ? (i.suppressed_reason === "complained" ? "Marked as spam" : "Bounced") : null,
    checked: !update.excluded_investor_ids.includes(i.id),
  }));
  const recipientCount = recipients.filter((r) => r.checked && !r.blocked).length;

  return (
    <AppShell>
      <p className="hint">
        <Link href="/dashboard">Updates</Link> / Draft
      </p>
      <h1 className="mt-2 text-4xl">{content.monthLabel}</h1>
      {m?.monthToDate && <p className="mt-2 text-muted">This month is still running. The numbers are month to date.</p>}

      <nav aria-label="Update steps" className="mt-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <Link href={`/updates/${update.id}/edit?step=${s.key}`} aria-current={s.key === step ? "step" : undefined} className={`badge no-underline ${s.key === step ? "" : "badge-quiet"}`}>
                <span className="num">{i + 1}</span> {s.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section className="mt-8" aria-labelledby="step-h">
        {step === "metrics" && m && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="step-h" className="text-3xl">
                Review the numbers
              </h2>
              <form action={recalculate}>
                <input type="hidden" name="id" value={update.id} />
                <button className="btn btn-secondary btn-sm">Recalculate from Stripe</button>
              </form>
            </div>
            <p className="mt-2 text-muted">
              Calculated from {m.sample ? "sample data" : "your Stripe subscriptions"}
              {conn?.last_checked_at ? ` on ${formatDateTime(conn.last_checked_at)}` : ""}. Currency: <span className="num">{m.currency.toUpperCase()}</span>.
            </p>
            {sp.error === "stripe" && (
              <p className="error mt-3" role="alert">
                Stripe could not be reached. The numbers below are from the last calculation.
              </p>
            )}
            {m.sample && (
              <p className="notice mt-4">
                <strong>Sample data.</strong> This demo account uses fictional subscriptions. Connect a real Stripe key in Settings to see your numbers.
              </p>
            )}
            {m.warnings.length > 0 && (
              <ul className="mt-4 space-y-2" aria-label="Warnings">
                {m.warnings.map((w) => (
                  <li key={w.code} className="notice">
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <MetricsForm id={update.id} figures={editableFigures(update)} />
            </div>
          </>
        )}

        {step === "bullets" && (
          <>
            <h2 id="step-h" className="mb-6 text-3xl">
              Write the bullets
            </h2>
            <BulletsForm id={update.id} bullets={update.bullets_json} />
          </>
        )}

        {step === "preview" && (
          <>
            <h2 id="step-h" className="text-3xl">
              Preview
            </h2>
            <p className="mt-2 text-muted">
              This is the email, with a sample greeting. The button opens each investor&apos;s own page.{" "}
              <Link href={`/updates/${update.id}/preview`}>See the hosted page</Link>.
            </p>
            <div className="card mt-6 overflow-hidden">
              <p className="border-b border-line px-4 py-3 text-[15px]">
                <span className="text-muted">Subject:</span> {renderUpdateEmail(content, { greetingName: "", readUrl: "" }).subject}
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                className="h-[640px] w-full bg-[#FAF7EF]"
                srcDoc={renderUpdateEmail(content, { greetingName: "[first name]", readUrl: `${env.appUrl()}/updates/${update.id}/preview`, unsubscribeUrl: "#" }).html}
              />
            </div>
            <Link href={`/updates/${update.id}/edit?step=recipients`} className="btn mt-6">
              Continue
            </Link>
          </>
        )}

        {step === "recipients" && (
          <>
            <h2 id="step-h" className="mb-6 text-3xl">
              Choose recipients
            </h2>
            <RecipientsForm id={update.id} options={recipients} copy={update.copy_to_founder} />
          </>
        )}

        {step === "send" && (
          <>
            <h2 id="step-h" className="mb-6 text-3xl">
              Test, then send
            </h2>
            <SendPanel id={update.id} testSentAt={update.test_sent_at} recipientCount={recipientCount} founderEmail={profile.email} mock={env.emailProvider() === "mock"} />
          </>
        )}
      </section>

      <form action={deleteDraft} className="mt-16 border-t border-line pt-6">
        <input type="hidden" name="id" value={update.id} />
        <button className="link-btn text-[15px]">Delete this draft</button>
      </form>
    </AppShell>
  );
}

function toInput(key: EditableKey, value: number, currency: string): string {
  return MONEY_KEYS.has(key) ? String(value / minorUnitFactor(currency)) : String(value);
}

function editableFigures(update: UpdateRow): EditableFigure[] {
  const m = update.metrics_json!;
  const calculated = figures(m);
  return figures(m, update.adjustments_json).map((f) => {
    const editable = (EDITABLE_KEYS as string[]).includes(f.key);
    const calc = calculated.find((c) => c.key === f.key)!;
    return {
      ...f,
      editable,
      calculatedDisplay: calc.display,
      calculatedInput: editable ? toInput(f.key as EditableKey, m[f.key as EditableKey], m.currency) : "",
      currentInput: editable ? toInput(f.key as EditableKey, f.value ?? 0, m.currency) : "",
    };
  });
}
