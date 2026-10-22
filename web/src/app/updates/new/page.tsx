import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TitleRow } from "@/components/title-row";
import { StepsAhead } from "@/components/steps-ahead";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";
import { monthLabel } from "@/lib/metrics/present";
import { defaultMonth, monthChoices } from "@/lib/months";
import { connectionLabel } from "@/components/forms/stripe-connect-panel";
import { NewUpdateForm } from "./new-update-form";
import { accessFor } from "@/lib/trial";
import { TrialEndedPanel } from "@/components/trial-notice";

export const metadata: Metadata = { title: "New update" };

export default async function NewUpdatePage() {
  const { supabase, user } = await requireUser();
  const setup = await getSetupState(supabase, user.id);
  if (setup.nextStep !== null) redirect(`/onboarding?step=${setup.nextStep}`);
  const { data } = await supabase.from("updates").select("month").eq("user_id", user.id);
  const now = new Date();
  const months = monthChoices(now).map((m, i) => ({ value: m, label: i === 0 ? `${monthLabel(m)}, so far` : monthLabel(m) }));

  return (
    <AppShell crumbs={[{ label: "Updates", href: "/dashboard" }, { label: "New update" }]}>
      <TitleRow title="New update" sub="Choose the month. Quillmarc reads Stripe and calculates the numbers. Nothing is sent yet." />
      <section className="setting !border-0 !pt-0" aria-labelledby="month-h">
        <div>
          <h2 id="month-h">Month</h2>
          <p className="desc">{setup.connection ? connectionLabel(setup.connection) : ""}</p>
        </div>
        <div className="setting-panel">
          {accessFor(setup.profile ?? {}).expired ? (
            <TrialEndedPanel access={accessFor(setup.profile ?? {})} />
          ) : (
          <NewUpdateForm months={months} defaultMonth={defaultMonth(now)} existing={(data ?? []).map((u) => String(u.month).slice(0, 7))} />
          )}
        </div>
      </section>
      <StepsAhead />
    </AppShell>
  );
}
