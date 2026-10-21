"use client";
import { useActionState } from "react";
import { createUpdate } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";

export function NewUpdateForm({ months, defaultMonth, existing }: { months: { value: string; label: string }[]; defaultMonth: string; existing: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUpdate, {});
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="month" className="label">
          Which month is this update about?
        </label>
        <select id="month" name="month" defaultValue={defaultMonth} className="field max-w-80">
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
              {existing.includes(m.value) ? " (already started)" : ""}
            </option>
          ))}
        </select>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn" disabled={pending}>
          {pending ? "Reading Stripe" : "Calculate the numbers"}
        </button>
      </div>
    </form>
  );
}
