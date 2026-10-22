import { env } from "@/lib/env";
import { TRIAL_ENDED_MESSAGE, type Access } from "@/lib/trial";

/** Where a founder goes to continue: the owner's payment link, or an email to the owner. */
export function continueHref(): string {
  const billing = env.billingUrl();
  if (billing) return billing;
  const contact = env.contactEmail();
  return contact ? `mailto:${contact}?subject=${encodeURIComponent("Continue with Quillmarc")}` : "/settings#plan";
}

// Shown in place of the send controls once the trial is over.
export function TrialEndedPanel({ access }: { access: Access }) {
  if (!access.expired) return null;
  return (
    <section className="panel panel-pad grid gap-3" aria-labelledby="trial-h" role="status">
      <h2 id="trial-h">{access.plan === "ended" ? "Access ended" : "Your free trial has ended"}</h2>
      <p className="text-muted">{TRIAL_ENDED_MESSAGE}</p>
      <div>
        <a href={continueHref()} className="btn no-underline">
          Continue with Quillmarc
        </a>
      </div>
    </section>
  );
}
