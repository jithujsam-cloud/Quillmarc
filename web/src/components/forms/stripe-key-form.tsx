"use client";
import { useActionState } from "react";
import { connectStripe, type FormState } from "@/lib/actions/setup";
import { REQUIRED_READ_PERMISSIONS } from "@/lib/stripe/permissions";

export function StripeKeyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(connectStripe, {});
  return (
    <div className="grid gap-4">
      <ol className="grid list-decimal gap-1.5 pl-5 text-muted">
        <li>
          In Stripe, open{" "}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">
            Developers, then API keys
          </a>
          , and choose Create restricted key.
        </li>
        <li>Set {REQUIRED_READ_PERMISSIONS.join(", ")} to Read. Leave the rest as None. In a sandbox with test clocks, also set Test clocks to Read.</li>
        <li>Create the key and paste it below. It starts with rk_live_, or rk_test_ from a Stripe sandbox if you want to try it on test data first.</li>
      </ol>
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="key" className="label">
            Restricted key
          </label>
          <input
            id="key"
            name="key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="field"
            placeholder="rk_live_..."
            aria-invalid={state.error ? true : undefined}
            aria-describedby={`key-hint${state.error ? " key-error" : ""}`}
          />
          <p id="key-hint" className="hint mt-2">
            We check it can read and cannot write, then encrypt it. It is never shown again.
          </p>
          {state.error && (
            <p id="key-error" className="error mt-2" role="alert">
              {state.error}
            </p>
          )}
        </div>
        <div>
          <button className="btn btn-secondary" disabled={pending} aria-busy={pending}>
            {pending ? "Checking the key" : "Connect with this key"}
          </button>
        </div>
      </form>
    </div>
  );
}
