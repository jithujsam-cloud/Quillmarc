"use client";
import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div role="status" className="panel panel-pad">
        <h2 className="text-[16px]">Check your email</h2>
        <p className="mt-2 text-muted">
          We sent a sign-in link to <span className="text-ink">{state.sent}</span>. Open it on this device. It works once and expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="panel panel-pad grid gap-4" noValidate>
      {linkError && !state.error && (
        <p className="error" role="alert">
          That link has expired or was already used. Ask for a new one.
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "email-error" : undefined} />
        {state.error && (
          <p id="email-error" className="error mt-2" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-lg w-full" disabled={pending}>
        {pending ? "Sending" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
