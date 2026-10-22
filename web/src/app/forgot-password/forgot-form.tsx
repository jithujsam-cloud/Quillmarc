"use client";
import { useActionState, useState } from "react";
import { requestReset, type LoginState } from "../login/actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestReset, {});
  const [email, setEmail] = useState("");
  if (state.sent) {
    return (
      <div role="status" className="panel panel-pad">
        <h2 className="text-[16px]">Check your email</h2>
        <p className="mt-2 text-muted">
          If there is an account for <span className="text-ink">{state.sent.email}</span>, a link to choose a new password is on its way. It works once and expires in one hour.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="panel panel-pad grid gap-4" noValidate>
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "email-error" : undefined} />
        {state.error && (
          <p id="email-error" className="error mt-2" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-lg w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Sending" : "Email me a reset link"}
      </button>
    </form>
  );
}
