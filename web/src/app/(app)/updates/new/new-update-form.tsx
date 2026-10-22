"use client";
import { useActionState, useMemo, useState } from "react";
import { createUpdate } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";

export interface PeriodOption {
  /** "start_end" */
  value: string;
  name: string;
  /** "1 Jul to 30 Sep 2026" */
  range: string;
  start: string;
  end: string;
  running: boolean;
  /** An update for exactly this period already exists. */
  started: boolean;
}

type Type = "month" | "quarter" | "year" | "custom";

const TYPES: { value: Type; label: string; hint: string }[] = [
  { value: "month", label: "Monthly", hint: "One calendar month." },
  { value: "quarter", label: "Quarterly", hint: "Three months: Jan to Mar, Apr to Jun, Jul to Sep or Oct to Dec." },
  { value: "year", label: "Annually", hint: "A calendar year." },
  { value: "custom", label: "Custom dates", hint: "Any range up to 24 months, ending today or earlier." },
];

// One question at a time: how often, then which one. The dates it will cover are always on screen.
export function NewUpdateForm({
  options,
  defaults,
  taken,
  today,
}: {
  options: Record<Exclude<Type, "custom">, PeriodOption[]>;
  defaults: Record<Exclude<Type, "custom">, string>;
  /** Existing updates as "start_end", to warn about overlaps. */
  taken: { label: string; start: string; end: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUpdate, {});
  const [type, setType] = useState<Type>("month");
  const [picked, setPicked] = useState<Record<string, string>>(defaults);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(today);

  const preset = type === "custom" ? null : options[type].find((o) => o.value === picked[type]) ?? options[type][0];
  const range = type === "custom" ? { start, end } : { start: preset?.start ?? "", end: preset?.end ?? "" };
  const ready = Boolean(range.start && range.end && range.end >= range.start);
  const overlap = useMemo(() => (ready ? taken.filter((t) => t.start <= range.end && range.start <= t.end && !(preset?.started && t.start === range.start && t.end === range.end)) : []), [ready, taken, range.start, range.end, preset?.started]);
  const hint = TYPES.find((t) => t.value === type)?.hint;

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="type" value={type} />
      <fieldset className="grid gap-2">
        <legend className="label">How often is this update?</legend>
        <div className="choice" role="radiogroup">
          {TYPES.map((t) => (
            <label key={t.value}>
              <input type="radio" name="kind" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
        <p className="hint">{hint}</p>
      </fieldset>

      {type !== "custom" ? (
        <fieldset className="grid gap-2">
          <legend className="label">Which {type}?</legend>
          <div className="pick-list">
            {options[type].map((o) => (
              <label key={o.value} className="pick" data-used={o.started ? "" : undefined}>
                <input type="radio" name="period" value={o.value} checked={(preset?.value ?? "") === o.value} onChange={() => setPicked((p) => ({ ...p, [type]: o.value }))} />
                <span className="pick-name">{o.name}</span>
                <span className="pick-sub">{o.started ? "Already started" : o.running ? "Still running, so far" : o.range}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <legend className="label">Which dates?</legend>
          <div>
            <label htmlFor="start" className="hint mb-1 block">
              First day
            </label>
            <input id="start" name="start" type="date" required max={today} value={start} onChange={(e) => setStart(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="end" className="hint mb-1 block">
              Last day
            </label>
            <input id="end" name="end" type="date" required min={start || undefined} max={today} value={end} onChange={(e) => setEnd(e.target.value)} className="field" />
          </div>
        </fieldset>
      )}

      <div className="notice-plain" aria-live="polite">
        {ready ? (
          <>
            This update will cover <strong>{formatRange(range.start, range.end)}</strong>
            {range.end >= today ? ", so far. The numbers will be to date." : "."}
          </>
        ) : (
          "Choose the dates to see what this update covers."
        )}
      </div>

      {overlap.length > 0 && (
        <p className="notice" role="status">
          This overlaps your {overlap.map((o) => o.label).join(" and ")} {overlap.length === 1 ? "update" : "updates"}. You can still create it. Investors may see some of the same numbers twice.
        </p>
      )}

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn btn-lg" disabled={pending || !ready} aria-busy={pending}>
          {pending ? "Reading Stripe" : "Calculate the numbers"}
        </button>
        <p className="hint mt-2">Nothing is sent yet. You review the numbers and write your bullets first.</p>
      </div>
    </form>
  );
}

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatRange(a: string, b: string): string {
  const f = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return `${day} ${M[m - 1]} ${y}`;
  };
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
}
