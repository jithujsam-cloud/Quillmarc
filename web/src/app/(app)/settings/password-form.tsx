"use client";
import { useActionState } from "react";
import { changePassword, type LoginState } from "@/app/login/actions";
import { PasswordField } from "@/components/password-field";
import { PASSWORD_MIN } from "@/lib/validate";

export function PasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid gap-4" noValidate key={state.saved ? "saved" : "form"}>
      <PasswordField id="new-password" label="New password" autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters.`} error={state.field === "password" ? state.error : undefined} />
      <PasswordField id="new-password-again" name="confirm" label="New password again" autoComplete="new-password" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-secondary" disabled={pending} aria-busy={pending}>
          Change password
        </button>
        <span aria-live="polite">{state.saved && <span className="ok">Password changed.</span>}</span>
      </div>
    </form>
  );
}
