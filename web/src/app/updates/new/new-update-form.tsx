"use client";
import { useActionState } from "react";
import { createUpdate } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";

export function NewUpdateForm({ months, defaultMonth, existing }: { months: { value: string; label: string }[]; defaultMonth: string; existing: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUpdate, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="month" className="label">
          Month
        </label>
        <select id="month" name="month" defaultValue={defaultMonth} className="field" aria-describedby="month-hint">
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
              {existing.includes(m.value) ? " (already started)" : ""}
            </option>
          ))}
        </select>
        <p id="month-hint" className="hint mt-2">
          We read your Stripe subscriptions and calculate the numbers. Nothing is sent yet.
        </p>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending}>
        {pending ? "Reading Stripe" : "Calculate the numbers"}
      </button>
    </form>
  );
}
