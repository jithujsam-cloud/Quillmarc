"use client";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import { PASSWORD_MIN } from "@/lib/validate";
import { updatePassword } from "../login/actions";
import type { LoginState } from "../login/actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(updatePassword, {});
  return (
    <form action={action} className="panel panel-pad grid gap-4" noValidate>
      <PasswordField id="password" label="New password" autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters.`} error={state.field === "password" ? state.error : undefined} />
      <PasswordField id="confirm" name="confirm" label="New password again" autoComplete="new-password" />
      <button type="submit" className="btn btn-lg w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Saving" : "Save password"}
      </button>
    </form>
  );
}
