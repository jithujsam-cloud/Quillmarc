"use client";
import { useActionState } from "react";
import { connectStripe, type FormState } from "@/lib/actions/setup";
import { REQUIRED_READ_PERMISSIONS } from "@/lib/stripe/permissions";

export function StripeKeyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(connectStripe, {});
  return (
    <div className="space-y-6">
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          In Stripe, open{" "}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">
            Developers, then API keys
          </a>
          .
        </li>
        <li>Choose Create restricted key. Name it Quillmarc.</li>
        <li>
          Set these to <strong>Read</strong>: {REQUIRED_READ_PERMISSIONS.join(", ")}. Leave everything else as None.
        </li>
        <li>Create the key, copy it, and paste it below. It starts with rk_live_.</li>
      </ol>
      <p className="hint">
        Quillmarc checks the key can read and cannot write. A key with any write access is refused. The key is encrypted and never shown again.
      </p>
      <form action={action} className="space-y-4" noValidate>
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
            className="field num"
            placeholder="rk_live_"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "key-error" : undefined}
          />
          {state.error && (
            <p id="key-error" className="error mt-2" role="alert">
              {state.error}
            </p>
          )}
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Checking the key" : "Connect Stripe"}
        </button>
      </form>
    </div>
  );
}
