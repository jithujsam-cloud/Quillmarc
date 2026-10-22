import type { Metadata } from "next";
import { connectionLabel, StripeConnectPanel } from "@/components/forms/stripe-connect-panel";
import { Setting, SettingsFrame } from "@/components/settings-frame";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { disconnectStripe } from "@/lib/actions/setup";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getSetupState } from "@/lib/setup";
import { connectMessage } from "@/lib/stripe/connect-messages";
import { getTimeZone } from "@/lib/timezone-server";

export const metadata: Metadata = { title: "Stripe settings" };

export default async function StripeSettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; stripe?: string }> }) {
  const { supabase, user } = await requireUser();
  const tz = await getTimeZone();
  const { connection } = await getSetupState(supabase, user.id);
  const { done, stripe } = await searchParams;
  const connectAvailable = Boolean(env.stripeConnect());
  const msg = connectMessage(stripe);

  return (
    <SettingsFrame tab="stripe" email={user.email}>
      <Setting
        id="stripe"
        title="Stripe"
        desc={
          connection ? (
            <>
              {connectionLabel(connection)}
              {connection.last_checked_at && <span className="mt-2 block">Last read {formatDateTime(connection.last_checked_at, tz.zone)}.</span>}
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
                <StripeConnectPanel from="settings" connectAvailable={connectAvailable} next="/settings/stripe" />
              </div>
            </details>
          </div>
        ) : (
          <StripeConnectPanel from="settings" connectAvailable={connectAvailable} code={stripe} next="/settings/stripe" />
        )}
      </Setting>
    </SettingsFrame>
  );
}
