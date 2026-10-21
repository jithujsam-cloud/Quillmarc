import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SenderForm } from "@/components/forms/sender-form";
import { connectionLabel, StripeConnectPanel } from "@/components/forms/stripe-connect-panel";
import { env } from "@/lib/env";
import { connectMessage } from "@/lib/stripe/connect-messages";
import { requireUser } from "@/lib/auth";
import { disconnectStripe } from "@/lib/actions/setup";
import { formatDateTime } from "@/lib/format";
import { getSetupState } from "@/lib/setup";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; stripe?: string }> }) {
  const { supabase, user } = await requireUser();
  const { profile, connection } = await getSetupState(supabase, user.id);
  const { done, stripe } = await searchParams;
  const connectAvailable = Boolean(env.stripeConnect());

  return (
    <AppShell>
      <h1 className="text-4xl">Settings</h1>
      <p className="mt-2 text-muted">
        Signed in as <span className="num break-all">{user.email}</span>
      </p>

      <section className="card mt-8 p-5 sm:p-8" aria-labelledby="sender-h">
        <h2 id="sender-h" className="mb-5 text-2xl">
          Sender details
        </h2>
        <SenderForm profile={profile} />
      </section>

      <section className="card mt-6 p-5 sm:p-8" aria-labelledby="stripe-h">
        <h2 id="stripe-h" className="text-2xl">
          Stripe
        </h2>
        {done === "disconnected" && (
          <p className="text-ok mt-3" role="status">
            Stripe is disconnected and the key is deleted.
          </p>
        )}
        {connection ? (
          <div className="mt-4 space-y-4">
            {connectMessage(stripe) && (
              <p className={connectMessage(stripe)!.ok ? "text-ok" : "error"} role="status">
                {connectMessage(stripe)!.text}
              </p>
            )}
            <p>
              {connectionLabel(connection)}
              {connection.last_checked_at && <> Last read {formatDateTime(connection.last_checked_at)}.</>}
            </p>
            {connection.status === "error" && <p className="notice">{connection.last_error}</p>}
            <form action={disconnectStripe}>
              <button className="btn btn-secondary">Disconnect Stripe</button>
            </form>
            <p className="hint">Disconnecting removes Quillmarc&apos;s access at once: the stored key is deleted, or the Stripe Connect link is revoked. Sent updates stay as they are.</p>
            <details>
              <summary className="cursor-pointer text-accent">Connect a different Stripe account</summary>
              <div className="mt-4">
                <StripeConnectPanel from="settings" connectAvailable={connectAvailable} next="/settings" />
              </div>
            </details>
          </div>
        ) : (
          <div className="mt-4">
            <StripeConnectPanel from="settings" connectAvailable={connectAvailable} code={stripe} next="/settings" />
          </div>
        )}
      </section>

      <section className="card mt-6 p-5 sm:p-8" aria-labelledby="delete-h">
        <h2 id="delete-h" className="text-2xl">
          Delete all my data
        </h2>
        <p className="mt-3">
          This deletes your account, your Stripe key, investors, updates, sends and tracking events. It happens at once and cannot be undone. Investors keep any emails already in their inbox, but the links in them stop working.
        </p>
        <div className="mt-5">
          <DeleteForm />
        </div>
      </section>

      <section className="mt-6" aria-label="Session">
        <form action="/auth/signout" method="post">
          <button className="btn btn-secondary">Sign out</button>
        </form>
      </section>
    </AppShell>
  );
}
