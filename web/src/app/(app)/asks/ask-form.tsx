"use client";
import { useActionState, useEffect, useRef } from "react";
import { addAsk } from "@/lib/actions/asks";
import type { FormState } from "@/lib/actions/setup";

export function AskForm({ investors }: { investors: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAsk, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) form.current?.reset();
  }, [state]);
  const err = state.fieldErrors?.text;
  return (
    <form ref={form} action={action} className="grid gap-4" noValidate>
      <div>
        <label htmlFor="ask-text" className="label">
          What are you asking for?
        </label>
        <textarea id="ask-text" name="text" rows={3} maxLength={500} className="field" placeholder="For example: an intro to a finance lead at a Series A company" aria-invalid={err ? true : undefined} aria-describedby={err ? "ask-text-error" : undefined} />
        {err && (
          <p id="ask-text-error" className="error mt-1" role="alert">
            {err}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="ask-investor" className="label">
          Who could help? <span className="font-normal text-muted">Optional</span>
        </label>
        <select id="ask-investor" name="investor" className="field" defaultValue="">
          <option value="">Anyone</option>
          {investors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ask-owner" className="label">
          Who is handling it? <span className="font-normal text-muted">Optional</span>
        </label>
        <input id="ask-owner" name="owner" maxLength={80} className="field" placeholder="You" />
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending} aria-busy={pending}>
          Add ask
        </button>
        <span aria-live="polite">{state.message && <span className="ok">{state.message}</span>}</span>
      </div>
    </form>
  );
}
