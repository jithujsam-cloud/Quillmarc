"use client";
import { useActionState, useEffect, useRef } from "react";
import { addInvestors, type FormState } from "@/lib/actions/setup";

export function InvestorPasteForm({ submitLabel = "Add investors" }: { submitLabel?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addInvestors, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message && !state.error) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-4" noValidate>
      <div>
        <label htmlFor="list" className="label">
          Paste your investors
        </label>
        <textarea id="list" name="list" rows={7} className="field" aria-describedby="list-hint" placeholder={"Jordan Lee, jordan@fund.com\nSam Rivera <sam@angel.co>"} />
        <p id="list-hint" className="hint mt-2">
          One per line, as Name, email. A CSV with name and email columns works too.
        </p>
      </div>
      <div aria-live="polite" className="grid gap-1">
        {state.message && <p className="ok">{state.message}</p>}
        {state.error && <p className="error">{state.error}</p>}
      </div>
      <div>
        <button className="btn" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
