import type { Metadata } from "next";
import { Setting, SettingsFrame } from "@/components/settings-frame";
import { continueHref } from "@/components/trial-notice";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getSetupState } from "@/lib/setup";
import { getTimeZone } from "@/lib/timezone-server";
import { accessFor, trialLabel } from "@/lib/trial";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const { profile } = await getSetupState(supabase, user.id);
  const a = accessFor(profile ?? {});

  return (
    <SettingsFrame tab="plan" email={user.email}>
      <Setting id="plan" title="Plan" desc={profile?.plan === "active" ? "Your account is active." : "Every new account gets 14 days with everything on. No card needed."}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`pill ${a.expired ? "pill-warn" : a.plan === "active" ? "pill-pos" : "pill-accent"}`}>{trialLabel(a)}</span>
            {a.plan === "trial" && profile?.trial_ends_at && (
              <span className="text-muted">
                {a.expired ? "Ended" : "Ends"} {formatDate(profile.trial_ends_at, tz.zone)}
              </span>
            )}
          </div>
          {a.plan !== "active" && (
            <div>
              <a href={continueHref()} className={`btn no-underline ${a.expired ? "" : "btn-secondary"}`}>
                Continue with Quillmarc
              </a>
            </div>
          )}
        </div>
      </Setting>
    </SettingsFrame>
  );
}
