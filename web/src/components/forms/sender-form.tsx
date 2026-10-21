"use client";
import { useActionState } from "react";
import { saveSender, type FormState } from "@/lib/actions/setup";
import type { ProfileRow } from "@/lib/db-types";

function Field({ name, label, hint, type = "text", value, error, autoComplete }: { name: string; label: string; hint?: string; type?: string; value: string; error?: string; autoComplete?: string }) {
  const describedBy = [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input id={name} name={name} type={type} defaultValue={value} autoComplete={autoComplete} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      {hint && (
        <p id={`${name}-hint`} className="hint mt-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="error mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SenderForm({ profile, next, submitLabel = "Save" }: { profile: ProfileRow | null; next?: string; submitLabel?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSender, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="founder_name" label="Your name" hint="Investors see it in the From line." value={profile?.founder_name ?? ""} error={fe.founder_name} autoComplete="name" />
      <Field name="company_name" label="Company name" hint="Used in the subject line." value={profile?.company_name ?? ""} error={fe.company_name} autoComplete="organization" />
      <Field name="reply_to_email" label="Reply-to email" hint="Investor replies go here. Use an inbox you read." type="email" value={profile?.reply_to_email ?? profile?.email ?? ""} error={fe.reply_to_email} autoComplete="email" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : submitLabel}
        </button>
        <span aria-live="polite">
          {state.message && <span className="ok">{state.message}</span>}
          {state.error && <span className="error">{state.error}</span>}
        </span>
      </div>
    </form>
  );
}
