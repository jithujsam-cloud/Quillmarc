"use client";
import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div role="status" className="card p-6">
        <h2 className="text-2xl">Check your email</h2>
        <p className="mt-3">
          We sent a sign-in link to <strong>{state.sent}</strong>. Open it on this device. It works once and expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-6" noValidate>
      {linkError && !state.error && (
        <p className="error" role="alert">
          That link has expired or was already used. Ask for a new one.
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
        />
        {state.error && (
          <p id="email-error" className="error mt-2" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? "Sending" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
