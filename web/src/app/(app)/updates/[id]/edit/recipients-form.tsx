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
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <fieldset className="panel">
        <legend className="sr-only">Send to</legend>
        <div className="panel-head">
          <h3 className="text-[16px] font-semibold">Send to</h3>
          <span className="meta">Everyone is ticked. Untick anyone who should not get this one.</span>
        </div>
        <ul>
          {options.map((o) => (
            <li key={o.id} className="border-t border-rule">
              <label className={`flex min-h-14 items-center gap-3 px-5 py-2.5 ${o.blocked ? "text-muted" : "cursor-pointer hover:bg-raised"}`}>
                <input type="checkbox" name="recipient" value={o.id} defaultChecked={o.checked && !o.blocked} disabled={Boolean(o.blocked)} className="check" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.name}</span>
                  <span className="block truncate text-[13px] text-faint" title={o.email}>{o.email}</span>
                </span>
                {o.blocked && <span className="pill">{o.blocked}</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="panel flex min-h-14 cursor-pointer items-center gap-3 px-5">
        <input type="checkbox" name="copy" defaultChecked={copy} className="check" />
        <span>
          <span className="block font-medium">Send me a copy</span>
          <span className="block text-[12px] text-faint">A separate email to you, never a BCC.</span>
        </span>
      </label>
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
