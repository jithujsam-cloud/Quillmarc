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
import { SubmitButton } from "@/components/submit-button";
import { LinkPending } from "@/components/link-pending";

export const metadata: Metadata = { title: "Edit update" };

const STEPS = [
  { key: "metrics", label: "Numbers" },
  { key: "bullets", label: "Bullets" },
  { key: "preview", label: "Preview", phoneOnly: true },
  { key: "recipients", label: "Recipients" },
  { key: "send", label: "Test and send" },
] as const;
type Step = (typeof STEPS)[number]["key"];

// The screen's question: "Are these numbers right, and is the email ready to send?"
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
  const bulletCount = update.bullets_json.wins.length + update.bullets_json.problems.length + update.bullets_json.asks.length;

  const email = renderUpdateEmail(content, { greetingName: "[first name]", readUrl: `${env.appUrl()}/updates/${update.id}/preview`, unsubscribeUrl: "#" });
  const from = `${content.founderName} via Quillmarc <updates@${env.sendingDomain()}>`;
  const previewPane = (
    <div className="panel overflow-hidden">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-line px-4 py-3 text-[13px]">
        <dt className="text-muted">From</dt>
        <dd className="truncate">{from}</dd>
        <dt className="text-muted">Subject</dt>
        <dd>{email.subject}</dd>
      </dl>
      <iframe title="Email preview" sandbox="" className="h-[640px] w-full bg-[#FAF7EF] lg:h-[calc(100dvh-210px)]" srcDoc={email.html} />
    </div>
  );

  const finding = !m
    ? "No numbers yet."
    : m.warnings.length
      ? `${m.warnings.length} ${m.warnings.length === 1 ? "thing" : "things"} to check in the numbers.`
      : `MRR ${figures(m, update.adjustments_json)[0].display}. ${bulletCount ? `${bulletCount} bullets written.` : "No bullets yet."} ${update.test_sent_at ? "Test sent." : "No test sent yet."}`;

  return (
    <AppShell
      crumbs={[{ label: "Updates", href: "/dashboard" }, { label: `${content.monthLabel} draft` }]}
      actions={
        <>
          <Link href={`/updates/${update.id}/preview`} className="btn btn-secondary btn-sm hide-phone">
            Preview page
          </Link>
          <Link href={`/updates/${update.id}/edit?step=send`} className="btn btn-secondary btn-sm">
            Send to {recipientCount}
          </Link>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="title-row !mb-4">
            <div className="min-w-0">
              <h1>{content.monthLabel} update</h1>
              <p className="sub">
                {finding}
                {m?.monthToDate ? " This month is still running, so figures are month to date." : ""}
              </p>
            </div>
          </div>

          <nav aria-label="Update steps" className="tabs mb-6">
            {STEPS.map((s) => (
              <Link key={s.key} href={`/updates/${update.id}/edit?step=${s.key}`} aria-current={s.key === step ? "step" : undefined} className={"phoneOnly" in s ? "lg:!hidden" : undefined}>
                {s.label}
                <LinkPending />
              </Link>
            ))}
          </nav>

          {step === "metrics" && m && (
            <section aria-labelledby="step-h" className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="step-h" className="text-[16px]">
                    Review the numbers
                  </h2>
                  <p className="meta mt-1">
                    From {m.sample ? "sample data" : "your Stripe subscriptions"}
                    {conn?.last_checked_at ? `, read ${formatDateTime(conn.last_checked_at)}` : ""}. {m.currency.toUpperCase()} only.
                  </p>
                </div>
                <form action={recalculate}>
                  <input type="hidden" name="id" value={update.id} />
                  <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Reading Stripe">
                    Recalculate
                  </SubmitButton>
                </form>
              </div>
              {sp.error === "stripe" && (
                <p className="error" role="alert">
                  Stripe could not be reached. These numbers are from the last calculation.
                </p>
              )}
              {m.sample && (
                <p className="notice">
                  <strong>Sample data.</strong> This demo account uses fictional subscriptions. Connect Stripe in Settings to see your own.
                </p>
              )}
              {m.warnings.length > 0 && (
                <ul className="grid gap-2" aria-label="Things to check">
                  {m.warnings.map((w) => (
                    <li key={w.code} className="notice">
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
              <MetricsForm id={update.id} figures={editableFigures(update)} />
            </section>
          )}

          {step === "bullets" && (
            <section aria-labelledby="step-h">
              <h2 id="step-h" className="sr-only">
                Write the bullets
              </h2>
              <BulletsForm id={update.id} bullets={update.bullets_json} />
            </section>
          )}

          {step === "preview" && (
            <section aria-labelledby="step-h" className="grid gap-4">
              <h2 id="step-h" className="text-[16px]">
                Preview
              </h2>
              <p className="text-muted">
                The email, with a sample greeting. <Link href={`/updates/${update.id}/preview`}>See the investor page</Link>
              </p>
              {previewPane}
              <div>
                <Link href={`/updates/${update.id}/edit?step=recipients`} className="btn">
                  Continue
                </Link>
              </div>
            </section>
          )}

          {step === "recipients" && (
            <section aria-labelledby="step-h">
              <h2 id="step-h" className="sr-only">
                Choose recipients
              </h2>
              <RecipientsForm id={update.id} options={recipients} copy={update.copy_to_founder} />
            </section>
          )}

          {step === "send" && (
            <section aria-labelledby="step-h">
              <h2 id="step-h" className="sr-only">
                Test, then send
              </h2>
              <SendPanel id={update.id} testSentAt={update.test_sent_at} recipientCount={recipientCount} founderEmail={profile.email} mock={env.emailProvider() === "mock"} />
            </section>
          )}

          <form action={deleteDraft} className="mt-12 border-t border-line pt-5">
            <input type="hidden" name="id" value={update.id} />
            <SubmitButton className="link-btn danger text-[13px]" pendingLabel="Deleting">
              Delete this draft
            </SubmitButton>
          </form>
        </div>

        <aside aria-label="Email preview" className="hidden min-w-0 lg:block">
          <div className="sticky top-[88px]">{previewPane}</div>
        </aside>
      </div>
    </AppShell>
  );
}

function toInput(key: EditableKey, value: number, currency: string): string {
  return MONEY_KEYS.has(key) ? String(value / minorUnitFactor(currency)) : String(value);
}

function editableFigures(update: UpdateRow): EditableFigure[] {
  const m = update.metrics_json!;
  const calculated = figures(m);
  const current = figures(m, update.adjustments_json);
  const byKey = (k: string) => current.find((x) => x.key === k)!;
  return current.map((f) => {
    const editable = (EDITABLE_KEYS as string[]).includes(f.key);
    const calc = calculated.find((c) => c.key === f.key)!;
    const sub =
      f.key === "mrr" ? `${byKey("growthPercent").display} vs last month` : f.key === "netNewMrr" ? `Last month ${byKey("previousMrr").display}` : f.key === "customers" ? `+${byKey("newCustomers").display} new, ${byKey("churnedCustomers").display} churned` : undefined;
    return {
      ...f,
      sub,
      editable,
      calculatedDisplay: calc.display,
      calculatedInput: editable ? toInput(f.key as EditableKey, m[f.key as EditableKey], m.currency) : "",
      currentInput: editable ? toInput(f.key as EditableKey, f.value ?? 0, m.currency) : "",
    };
  });
}
