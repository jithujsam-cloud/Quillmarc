"use client";
import { useActionState } from "react";
import { saveRecipients } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";

export interface RecipientOption {
  id: string;
  name: string;
  email: string;
  blocked: string | null;
  checked: boolean;
}

export function RecipientsForm({ id, options, copy }: { id: string; options: RecipientOption[]; copy: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecipients, {});
  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className="label">Send to</legend>
        <p className="hint mb-3">Everyone is ticked by default. Untick anyone who should not get this one.</p>
        <ul className="divide-y divide-line border-y border-line">
          {options.map((o) => (
            <li key={o.id}>
              <label className={`flex min-h-12 items-center gap-3 py-3 ${o.blocked ? "text-muted" : "cursor-pointer"}`}>
                <input type="checkbox" name="recipient" value={o.id} defaultChecked={o.checked && !o.blocked} disabled={Boolean(o.blocked)} className="size-5 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block">{o.name}</span>
                  <span className="num block break-all text-[15px] text-muted">{o.email}</span>
                </span>
                {o.blocked && <span className="badge badge-quiet">{o.blocked}</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="copy" defaultChecked={copy} className="size-5 accent-[var(--accent)]" />
        <span>Send me a copy as a separate email</span>
      </label>
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
