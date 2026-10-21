"use client";
import { useActionState } from "react";
import { saveBullets } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";
import type { Bullets } from "@/lib/email/render";

const GROUPS: { key: keyof Bullets; label: string; hint: string }[] = [
  { key: "wins", label: "Wins", hint: "What went well. A deal closed, a launch, a hire." },
  { key: "problems", label: "Problems", hint: "What is hard right now. Investors trust founders who say it plainly." },
  { key: "asks", label: "Asks", hint: "What investors can do for you. An intro, advice, a hire." },
];

export function BulletsForm({ id, bullets }: { id: string; bullets: Bullets }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBullets, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="panel panel-pad grid gap-5">
        <p className="text-muted">One point per line. About five in all is plenty. An empty group is left out.</p>
        {GROUPS.map((g) => (
          <div key={g.key}>
            <label htmlFor={g.key} className="label !mb-1">
              {g.label}
            </label>
            <p id={`${g.key}-hint`} className="hint mb-2">
              {g.hint}
            </p>
            <textarea id={g.key} name={g.key} rows={3} defaultValue={bullets[g.key].join("\n")} className="field" aria-describedby={`${g.key}-hint`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" name="continue" value="1" disabled={pending}>
          Save and continue
        </button>
        <button className="btn btn-secondary" disabled={pending}>
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
