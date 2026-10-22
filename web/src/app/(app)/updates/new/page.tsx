import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TitleRow } from "@/components/title-row";
import { StepsAhead } from "@/components/steps-ahead";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";
import { defaultPeriod, isRunning, periodChoices, periodFromRow, periodLabel, periodRange, toDate } from "@/lib/periods";
import { connectionLabel } from "@/components/forms/stripe-connect-panel";
import { NewUpdateForm, type PeriodOption } from "./new-update-form";
import { accessFor } from "@/lib/trial";
import { TrialEndedPanel } from "@/components/trial-notice";
import type { UpdateRow } from "@/lib/db-types";

export const metadata: Metadata = { title: "New update" };

const PRESETS = ["month", "quarter", "year"] as const;

export default async function NewUpdatePage() {
  const { supabase, user } = await requireUser();
  const setup = await getSetupState(supabase, user.id);
  if (setup.nextStep !== null) redirect(`/onboarding?step=${setup.nextStep}`);
  const { data } = await supabase.from("updates").select("period_type, period_start, period_end").eq("user_id", user.id);
  const existing = (data ?? []).map((u) => periodFromRow(u as Pick<UpdateRow, "period_type" | "period_start" | "period_end">));
  const now = new Date();

  const options = {} as Record<(typeof PRESETS)[number], PeriodOption[]>;
  const defaults = {} as Record<(typeof PRESETS)[number], string>;
  for (const type of PRESETS) {
    options[type] = periodChoices(type, now).map((p) => ({
      value: `${p.start}_${p.end}`,
      name: periodLabel(p),
      range: periodRange(p),
      start: p.start,
      end: p.end,
      running: isRunning(p, now),
      started: existing.some((e) => e.type === p.type && e.start === p.start && e.end === p.end),
    }));
    const d = defaultPeriod(type, now);
    defaults[type] = `${d.start}_${d.end}`;
  }
  const taken = existing.map((e) => ({ label: periodLabel(e), start: e.start, end: e.end }));

  return (
    <AppShell crumbs={[{ label: "Updates", href: "/updates" }, { label: "New update" }]}>
      <TitleRow title="New update" sub="Choose what this update covers. Quillmarc reads Stripe and calculates the numbers. Nothing is sent yet." />
      <section className="setting !border-0 !pt-0" aria-labelledby="period-h">
        <div>
          <h2 id="period-h">Period</h2>
          <p className="desc">{setup.connection ? connectionLabel(setup.connection) : ""}</p>
        </div>
        <div className="setting-panel">
          {accessFor(setup.profile ?? {}).expired ? <TrialEndedPanel access={accessFor(setup.profile ?? {})} /> : <NewUpdateForm options={options} defaults={defaults} taken={taken} today={toDate(now.getTime())} />}
        </div>
      </section>
      <StepsAhead />
    </AppShell>
  );
}

