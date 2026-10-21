"use client";
import { useActionState } from "react";
import { deleteAccount, type FormState } from "@/lib/actions/setup";

export function DeleteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="confirm" className="label">
          Type DELETE to confirm
        </label>
        <input id="confirm" name="confirm" autoComplete="off" className="field max-w-60" aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "confirm-error" : undefined} />
        {state.error && (
          <p id="confirm-error" className="error mt-2" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button className="btn btn-danger" disabled={pending}>
        {pending ? "Deleting" : "Delete all my data"}
      </button>
    </form>
  );
}
