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

  const from = `${content.founderName} via Quillmarc <updates@${env.sendingDomain()}>`;
  const previewEmail = renderUpdateEmail(content, { greetingName: "[first name]", readUrl: `${env.appUrl()}/updates/${update.id}/preview`, unsubscribeUrl: "#" });
  const previewPane = (
    <div className="card overflow-hidden">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-line px-4 py-3 text-[15px]">
        <dt className="text-muted">From</dt>
        <dd className="truncate">{from}</dd>
        <dt className="text-muted">Subject</dt>
        <dd>{previewEmail.subject}</dd>
      </dl>
      <iframe title="Email preview" sandbox="" className="h-[640px] w-full bg-[#FAF7EF] lg:h-[calc(100dvh-220px)]" srcDoc={previewEmail.html} />
    </div>
  );

  const topBar = (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
      <p className="text-[15px] text-muted">
        <Link href="/dashboard">Updates</Link> / <span className="text-ink">{content.monthLabel}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="hidden items-center gap-2 text-[14px] text-muted sm:inline-flex">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
          Draft saved
        </span>
        <Link href={`/updates/${update.id}/preview`} className="btn btn-secondary btn-sm no-underline">
          Preview
        </Link>
        <Link href={`/updates/${update.id}/edit?step=send`} className="btn btn-sm no-underline">
          Send to {recipientCount} {recipientCount === 1 ? "investor" : "investors"}
        </Link>
      </div>
    </div>
  );

  return (
    <AppShell width="full" topBar={topBar}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div>
      <h1 className="text-4xl">{content.monthLabel}</h1>
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
            <div className="mt-6 lg:hidden">{previewPane}</div>
            <p className="mt-6 hidden text-muted lg:block">The email is shown on the right.</p>
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
      </div>
      <aside aria-label="Live preview" className="hidden lg:block">
        <div className="sticky top-24">
          <p className="mb-3 text-[14px] font-medium text-muted">Preview</p>
          {previewPane}
        </div>
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
  return figures(m, update.adjustments_json).map((f) => {
    const editable = (EDITABLE_KEYS as string[]).includes(f.key);
    const calc = calculated.find((c) => c.key === f.key)!;
    const byKey = (k: string) => figures(m, update.adjustments_json).find((x) => x.key === k)!;
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
