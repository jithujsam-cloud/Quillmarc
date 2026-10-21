import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { connectionLabel, StripeConnectPanel } from "@/components/forms/stripe-connect-panel";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { SenderForm } from "@/components/forms/sender-form";
import { TitleRow } from "@/components/title-row";
import { StepsAhead } from "@/components/steps-ahead";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getSetupState } from "@/lib/setup";

export const metadata: Metadata = { title: "Set up" };

const STEPS = [
  { title: "Connect Stripe", why: "Quillmarc reads your subscriptions to calculate MRR, customers and growth. Read only." },
  { title: "Add investors", why: "Each investor gets their own email and their own page. Nobody sees who else received it." },
  { title: "Sender details", why: "Your name in the From line, your company in the subject, and where replies go." },
] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; stripe?: string }> }) {
  const { supabase, user } = await requireUser();
  const state = await getSetupState(supabase, user.id);
  const sp = await searchParams;
  const requested = Number(sp.step);
  const step = ([1, 2, 3].includes(requested) ? requested : state.nextStep ?? 1) as 1 | 2 | 3;
  if (!requested && state.nextStep === null) redirect("/dashboard");
  const done = [Boolean(state.connection), state.investorCount > 0, state.senderDone];
  const current = STEPS[step - 1];

  return (
    <AppShell crumbs={[{ label: "Updates", href: "/dashboard" }, { label: "Set up" }]}>
      <TitleRow title="Set up Quillmarc" sub={`${done.filter(Boolean).length} of 3 done. About five minutes in all.`} />

      <nav aria-label="Setup steps" className="tabs mb-6">
        {STEPS.map((s, i) => (
          <Link key={s.title} href={`/onboarding?step=${i + 1}`} aria-current={i + 1 === step ? "step" : undefined}>
            {s.title}
            {done[i] && <span className="pill pill-pos">Done</span>}
          </Link>
        ))}
      </nav>

      <section className="setting !border-0 !pt-0" aria-labelledby="step-h">
        <div>
          <h2 id="step-h">{current.title}</h2>
          <p className="desc">{current.why}</p>
        </div>
        <div className="setting-panel">
          {step === 1 &&
            (state.connection ? (
              <div className="grid gap-4">
                {sp.stripe === "connected" && (
                  <p className="ok" role="status">
                    Stripe is connected.
                  </p>
                )}
                <p>{connectionLabel(state.connection)}</p>
                <div>
                  <Link href="/onboarding?step=2" className="btn">
                    Continue
                  </Link>
                </div>
              </div>
            ) : (
              <StripeConnectPanel from="onboarding" connectAvailable={Boolean(env.stripeConnect())} code={sp.stripe} next="/onboarding?step=2" />
            ))}

          {step === 2 && (
            <div className="grid gap-5">
              {sp.stripe === "connected" && (
                <p className="ok" role="status">
                  Stripe is connected with read-only access.
                </p>
              )}
              {state.investorCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-tint px-4 py-3 text-accent-ink">
                  <span>
                    {state.investorCount} {state.investorCount === 1 ? "investor" : "investors"} added. <Link href="/investors">See the list</Link>
                  </span>
                  <Link href="/onboarding?step=3" className="btn btn-sm">
                    Continue
                  </Link>
                </div>
              )}
              <InvestorPasteForm />
            </div>
          )}

          {step === 3 && <SenderForm profile={state.profile} next="/dashboard" submitLabel="Finish setup" />}
        </div>
      </section>
      <StepsAhead heading="After setup, each month" />
    </AppShell>
  );
}
