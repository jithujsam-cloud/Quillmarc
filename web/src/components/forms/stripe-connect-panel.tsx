import { StripeKeyForm } from "./stripe-key-form";
import { connectMessage } from "@/lib/stripe/connect-messages";

// Connect with Stripe first (one click, read only). The restricted key stays as a fallback,
// and is the only option when Connect is not set up on this server.
export function StripeConnectPanel({ from, connectAvailable, code, next }: { from: "onboarding" | "settings"; connectAvailable: boolean; code?: string; next: string }) {
  const message = connectMessage(code);
  return (
    <div className="grid gap-5">
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "ok" : "error"}>
          {message.text}
        </p>
      )}
      {connectAvailable ? (
        <>
          <div className="grid gap-3">
            <p>Quillmarc asks Stripe for read-only access. It reads subscriptions and invoices. It cannot charge, refund or change anything.</p>
            <div>
              {/* A plain link, not next/link: this route redirects to Stripe and must not be prefetched. */}
              <a href={`/api/stripe/connect?from=${from}`} className="btn btn-lg">
                Connect with Stripe
              </a>
            </div>
            <p className="hint">You approve it on Stripe&apos;s own page, and you can remove access at any time.</p>
          </div>
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer font-medium text-accent">Paste a restricted key instead</summary>
            <div className="mt-4">
              <StripeKeyForm next={next} />
            </div>
          </details>
        </>
      ) : (
        <StripeKeyForm next={next} />
      )}
    </div>
  );
}

export function connectionLabel(c: { method: string; account_name: string | null; key_last4: string | null; key_mode: string | null }) {
  const mode = c.key_mode === "test" ? " (test mode)" : "";
  if (c.method === "sample") return "Connected to sample data from the demo seed.";
  if (c.method === "oauth") return `Connected with Stripe Connect to ${c.account_name ?? "your Stripe account"}${mode}. Read only.`;
  return `Connected with a restricted key ending ${c.key_last4 ?? ""}${mode}. Read only.`;
}
