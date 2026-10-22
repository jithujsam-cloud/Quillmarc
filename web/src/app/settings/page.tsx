import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SenderForm } from "@/components/forms/sender-form";
import { connectionLabel, StripeConnectPanel } from "@/components/forms/stripe-connect-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { TitleRow } from "@/components/title-row";
import { requireUser } from "@/lib/auth";
import { disconnectStripe } from "@/lib/actions/setup";
import { env } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSetupState } from "@/lib/setup";
import { connectMessage } from "@/lib/stripe/connect-messages";
import { DeleteForm } from "./delete-form";
import { accessFor, trialLabel } from "@/lib/trial";
import { continueHref } from "@/components/trial-notice";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Settings" };

function Setting({ id, title, desc, children }: { id: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="setting" aria-labelledby={`${id}-h`} id={id}>
      <div>
        <h2 id={`${id}-h`}>{title}</h2>
        <div className="desc">{desc}</div>
      </div>
      <div className="setting-panel">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; stripe?: string }> }) {
  const { supabase, user } = await requireUser();
  const { profile, connection } = await getSetupState(supabase, user.id);
  const { done, stripe } = await searchParams;
  const connectAvailable = Boolean(env.stripeConnect());
  const msg = connectMessage(stripe);

  return (
    <AppShell crumbs={[{ label: "Settings" }]}>
      <TitleRow title="Settings" sub={<>Signed in as {user.email}</>} />

      <Setting
        id="plan"
        title="Plan"
        desc={profile?.plan === "active" ? "Your account is active." : "Every new account gets 14 days with everything on. No card needed."}
      >
        {(() => {
          const a = accessFor(profile ?? {});
          return (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`pill ${a.expired ? "pill-warn" : a.plan === "active" ? "pill-pos" : "pill-accent"}`}>{trialLabel(a)}</span>
                {a.plan === "trial" && profile?.trial_ends_at && <span className="text-muted">{a.expired ? "Ended" : "Ends"} {formatDate(profile.trial_ends_at)}</span>}
              </div>
              {a.plan !== "active" && (
                <div>
                  <a href={continueHref()} className={`btn no-underline ${a.expired ? "" : "btn-secondary"}`}>
                    Continue with Quillmarc
                  </a>
                </div>
              )}
            </div>
          );
        })()}
      </Setting>

      <Setting id="sender" title="Sender details" desc="How your update arrives: who it is from, the subject, and where replies go.">
        <SenderForm profile={profile} />
      </Setting>

      <Setting
        id="stripe"
        title="Stripe"
        desc={
          connection ? (
            <>
              {connectionLabel(connection)}
              {connection.last_checked_at && <span className="mt-2 block">Last read {formatDateTime(connection.last_checked_at)}.</span>}
            </>
          ) : (
            "Not connected. Quillmarc reads subscriptions to calculate your numbers. Read only."
          )
        }
      >
        {done === "disconnected" && (
          <p className="ok mb-4" role="status">
            Stripe is disconnected and the key is deleted.
          </p>
        )}
        {connection ? (
          <div className="grid gap-4">
            {msg && (
              <p className={msg.ok ? "ok" : "error"} role="status">
                {msg.text}
              </p>
            )}
            {connection.status === "error" && <p className="notice">{connection.last_error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <form action={disconnectStripe}>
                <SubmitButton className="btn btn-secondary" pendingLabel="Disconnecting">
                  Disconnect Stripe
                </SubmitButton>
              </form>
              <span className="hint">Removes access at once. Sent updates stay as they are.</span>
            </div>
            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer font-medium text-accent">Connect a different Stripe account</summary>
              <div className="mt-4">
                <StripeConnectPanel from="settings" connectAvailable={connectAvailable} next="/settings" />
              </div>
            </details>
          </div>
        ) : (
          <StripeConnectPanel from="settings" connectAvailable={connectAvailable} code={stripe} next="/settings" />
        )}
      </Setting>

      <Setting id="appearance" title="Appearance" desc="Light, dark, or match your computer. Saved on this device.">
        <div className="flex items-center justify-between gap-4">
          <span>Theme</span>
          <ThemeToggle />
        </div>
      </Setting>

      <Setting id="delete" title="Delete all my data" desc="Deletes your account, Stripe access, investors, updates, sends and tracking events at once. This cannot be undone. Links in emails already sent stop working.">
        <DeleteForm />
      </Setting>
    </AppShell>
  );
}
