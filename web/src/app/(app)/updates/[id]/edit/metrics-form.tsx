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
  /** A short line under the figure, like the growth against the period before. */
  sub?: string;
}

// All seven figures in one divided panel: label over value, the note one click away.
export function MetricsForm({ id, figures }: { id: string; figures: EditableFigure[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdjustments, {});
  const [editing, setEditing] = useState<Record<string, boolean>>(() => Object.fromEntries(figures.filter((f) => f.adjusted && f.editable).map((f) => [f.key, true])));
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <ul className="panel grid overflow-hidden sm:grid-cols-2">
        {figures.map((f, i) => {
          const open = editing[f.key] || Boolean(fe[f.key]);
          return (
            // The lead figure (MRR) spans the row; the other six sit two by two, so no cell is left alone.
            <li key={f.key} className={`border-line p-5 ${i > 0 ? "border-t" : ""} ${i === 0 || open ? "sm:col-span-2" : ""} ${i > 0 && i % 2 === 0 && !open ? "sm:border-l" : ""} ${i === 2 ? "sm:border-t" : ""}`}>
              <div className="flex min-h-8 items-center justify-between gap-3">
                <p className="text-[13px] text-muted">{f.label}</p>
                {f.editable && !open && (
                  <button type="button" className="btn btn-ghost btn-sm -my-1 -mr-2" onClick={() => setEditing((e) => ({ ...e, [f.key]: true }))} aria-label={`Edit ${f.label}`}>
                    Edit
                  </button>
                )}
              </div>
              <p className={`font-medium tracking-tight ${i === 0 ? "text-[32px] leading-[38px]" : "text-[24px] leading-[30px]"}`}>{f.display}</p>
              {f.sub && <p className="mt-0.5 text-[12px] text-faint">{f.sub}</p>}
              {f.compare && (
                <p className="delta mt-0.5" data-tone={f.compare.tone}>
                  vs {f.compare.label}: {f.compare.display}
                  {f.compare.delta ? ` (${f.compare.delta})` : ""}
                </p>
              )}
              {(f.adjusted || f.estimated) && (
                <p className="mt-2 flex flex-wrap gap-2">
                  {f.adjusted && <span className="pill pill-accent">Adjusted by founder</span>}
                  {f.estimated && <span className="pill pill-quiet">Estimated</span>}
                </p>
              )}
              {f.editable && open && (
                <div className="mt-4 grid gap-2">
                  <label htmlFor={`adj-${f.key}`} className="label !mb-0">
                    Your figure for {f.label}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`adj-${f.key}`}
                      name={f.key}
                      inputMode="decimal"
                      defaultValue={f.currentInput}
                      className="field max-w-48"
                      aria-invalid={fe[f.key] ? true : undefined}
                      aria-describedby={`calc-${f.key}${fe[f.key] ? ` err-${f.key}` : ""}`}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => {
                        const input = e.currentTarget.form?.elements.namedItem(f.key) as HTMLInputElement | null;
                        if (input) input.value = f.calculatedInput;
                      }}
                    >
                      Use calculated
                    </button>
                  </div>
                  <p id={`calc-${f.key}`} className="hint">
                    Calculated: {f.calculatedDisplay}. A changed figure is marked &ldquo;adjusted by founder&rdquo; for investors.
                  </p>
                  {fe[f.key] && (
                    <p id={`err-${f.key}`} className="error" role="alert">
                      {fe[f.key]}
                    </p>
                  )}
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] text-accent">How this was calculated</summary>
                <p className="mt-2 text-[13px] leading-[18px] text-muted">{f.note}</p>
              </details>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" name="continue" value="1" disabled={pending} aria-busy={pending}>
          Save and continue
        </button>
        <button className="btn btn-secondary" disabled={pending} aria-busy={pending}>
          Save
        </button>
        <span aria-live="polite">
          {state.message && <span className="ok">{state.message}</span>}
          {state.error && <span className="error">{state.error}</span>}
        </span>
      </div>
    </form>
  );
}
