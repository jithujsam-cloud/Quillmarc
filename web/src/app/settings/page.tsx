import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SenderForm } from "@/components/forms/sender-form";
import { StripeKeyForm } from "@/components/forms/stripe-key-form";
import { requireUser } from "@/lib/auth";
import { disconnectStripe } from "@/lib/actions/setup";
import { formatDateTime } from "@/lib/format";
import { getSetupState } from "@/lib/setup";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { supabase, user } = await requireUser();
  const { profile, connection } = await getSetupState(supabase, user.id);
  const { done } = await searchParams;

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
            <p>
              {connection.method === "sample" ? (
                "Connected to sample data from the demo seed."
              ) : (
                <>
                  Connected with a {connection.key_mode === "test" ? "test mode" : "live"} restricted key ending <span className="num">{connection.key_last4}</span>.
                </>
              )}
              {connection.last_checked_at && <> Last read {formatDateTime(connection.last_checked_at)}.</>}
            </p>
            {connection.status === "error" && <p className="notice">{connection.last_error}</p>}
            <form action={disconnectStripe}>
              <button className="btn btn-secondary">Disconnect Stripe</button>
            </form>
            <p className="hint">Disconnecting deletes the stored key at once. Sent updates stay as they are.</p>
            <details>
              <summary className="cursor-pointer text-accent">Replace the key</summary>
              <div className="mt-4">
                <StripeKeyForm next="/settings" />
              </div>
            </details>
          </div>
        ) : (
          <div className="mt-4">
            <StripeKeyForm next="/settings" />
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
