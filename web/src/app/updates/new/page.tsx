import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getSetupState } from "@/lib/setup";
import { monthLabel } from "@/lib/metrics/present";
import { defaultMonth, monthChoices } from "@/lib/months";
import { NewUpdateForm } from "./new-update-form";

export const metadata: Metadata = { title: "New update" };

export default async function NewUpdatePage() {
  const { supabase, user } = await requireUser();
  const setup = await getSetupState(supabase, user.id);
  if (setup.nextStep !== null) redirect(`/onboarding?step=${setup.nextStep}`);
  const { data } = await supabase.from("updates").select("month").eq("user_id", user.id);
  const now = new Date();
  const months = monthChoices(now).map((m, i) => ({ value: m, label: i === 0 ? `${monthLabel(m)}, so far` : monthLabel(m) }));

  return (
    <AppShell>
      <h1 className="text-4xl">New update</h1>
      <p className="mt-2 text-muted">Which month is this update about?</p>
      <section className="card mt-8 p-5 sm:p-8">
        <NewUpdateForm months={months} defaultMonth={defaultMonth(now)} existing={(data ?? []).map((u) => String(u.month).slice(0, 7))} />
      </section>
    </AppShell>
  );
}
