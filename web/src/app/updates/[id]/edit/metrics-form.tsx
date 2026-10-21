"use client";
import { useActionState, useState } from "react";
import { saveAdjustments } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";
import type { Figure } from "@/lib/metrics/present";

export interface EditableFigure extends Figure {
  editable: boolean;
  /** The calculated value, in the unit the founder types (major units for money). */
  calculatedInput: string;
  /** The current value, same unit. */
  currentInput: string;
  calculatedDisplay: string;
}

export function MetricsForm({ id, figures }: { id: string; figures: EditableFigure[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdjustments, {});
  const [editing, setEditing] = useState<Record<string, boolean>>(() => Object.fromEntries(figures.filter((f) => f.adjusted && f.editable).map((f) => [f.key, true])));
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-3">
        {figures.map((f) => {
          const open = editing[f.key] || Boolean(fe[f.key]);
          return (
            <li key={f.key} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] text-muted">{f.label}</p>
                  <p className="num mt-1 text-3xl">{f.display}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.adjusted && <span className="badge">Adjusted by founder</span>}
                    {f.estimated && <span className="badge badge-quiet">Estimated</span>}
                  </div>
                </div>
                {f.editable && !open && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing((e) => ({ ...e, [f.key]: true }))} aria-label={`Edit ${f.label}`}>
                    Edit
                  </button>
                )}
              </div>
              {f.editable && open && (
                <div className="mt-4">
                  <label htmlFor={`adj-${f.key}`} className="label">
                    Your figure for {f.label}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`adj-${f.key}`}
                      name={f.key}
                      inputMode="decimal"
                      defaultValue={f.currentInput}
                      className="field num max-w-60"
                      aria-invalid={fe[f.key] ? true : undefined}
                      aria-describedby={`calc-${f.key}${fe[f.key] ? ` err-${f.key}` : ""}`}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm self-center"
                      onClick={(e) => {
                        const input = (e.currentTarget.form?.elements.namedItem(f.key) as HTMLInputElement | null) ?? null;
                        if (input) input.value = f.calculatedInput;
                      }}
                    >
                      Use calculated
                    </button>
                  </div>
                  <p id={`calc-${f.key}`} className="hint mt-2">
                    Calculated: <span className="num">{f.calculatedDisplay}</span>. A figure you change is marked &ldquo;adjusted by founder&rdquo; in the update.
                  </p>
                  {fe[f.key] && (
                    <p id={`err-${f.key}`} className="error mt-1" role="alert">
                      {fe[f.key]}
                    </p>
                  )}
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-[15px] text-accent">How this was calculated</summary>
                <p className="mt-2 text-[15px] text-muted">{f.note}</p>
              </details>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite">
        {state.message && <p className="text-ok">{state.message}</p>}
        {state.error && <p className="error">{state.error}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn" name="continue" value="1" disabled={pending}>
          Save and continue
        </button>
        <button className="btn btn-secondary" disabled={pending}>
          Save
        </button>
      </div>
    </form>
  );
}
