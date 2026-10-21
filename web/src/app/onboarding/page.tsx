import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StripeKeyForm } from "@/components/forms/stripe-key-form";
import { InvestorPasteForm } from "@/components/forms/investor-paste-form";
import { SenderForm } from "@/components/forms/sender-form";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";

export const metadata: Metadata = { title: "Set up" };

const STEPS = ["Connect Stripe", "Add investors", "Sender details"] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { supabase, user } = await requireUser();
  const state = await getSetupState(supabase, user.id);
  const requested = Number((await searchParams).step);
  const step = ([1, 2, 3].includes(requested) ? requested : state.nextStep ?? 1) as 1 | 2 | 3;
  if (!requested && state.nextStep === null) redirect("/dashboard");

  return (
    <AppShell>
      <p className="hint">
        Step {step} of 3
      </p>
      <h1 className="mt-2 text-4xl">{STEPS[step - 1]}</h1>
      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n === 1 ? !!state.connection : n === 2 ? state.investorCount > 0 : state.senderDone;
          return (
            <li key={label}>
              <Link href={`/onboarding?step=${n}`} aria-current={n === step ? "step" : undefined} className={`badge no-underline ${n === step ? "" : "badge-quiet"}`}>
                <span className="num">{n}</span> {label}
                {done && <span className="sr-only">, done</span>}
                {done && <span aria-hidden="true">✓</span>}
              </Link>
            </li>
          );
        })}
      </ol>

      <section className="card mt-8 p-5 sm:p-8">
        {step === 1 &&
          (state.connection ? (
            <div className="space-y-4">
              <p>
                Stripe is connected{state.connection.method === "sample" ? " with sample data" : state.connection.key_last4 ? <> with the key ending <span className="num">{state.connection.key_last4}</span></> : ""}.
              </p>
              <Link href="/onboarding?step=2" className="btn">
                Continue
              </Link>
            </div>
          ) : (
            <StripeKeyForm next="/onboarding?step=2" />
          ))}

        {step === 2 && (
          <div className="space-y-6">
            {state.investorCount > 0 && (
              <p>
                You have <span className="num">{state.investorCount}</span> {state.investorCount === 1 ? "investor" : "investors"}.{" "}
                <Link href="/investors">See the list</Link>.
              </p>
            )}
            <InvestorPasteForm />
            {state.investorCount > 0 && (
              <Link href="/onboarding?step=3" className="btn btn-secondary">
                Continue
              </Link>
            )}
          </div>
        )}

        {step === 3 && <SenderForm profile={state.profile} next="/dashboard" submitLabel="Finish setup" />}
      </section>
    </AppShell>
  );
}
