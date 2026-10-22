export function SetupPanel({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Connect Stripe", "Add investors", "Sender details"];
  const done = step - 1;
  return (
    <section className="panel panel-pad" aria-labelledby="setup-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setup-h">Set up Quillmarc</h2>
        <span className="meta">{done} of 3 done</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={done} aria-label="Setup progress">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(done / 3) * 100}%` }} />
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-lg p-4 ${i + 1 === step ? "bg-tint text-accent-ink" : "bg-raised text-muted"}`}>
            <p className="font-medium">{s}</p>
            <p className="mt-1 text-[13px]">{i + 1 < step ? "Done" : i + 1 === step ? "Next" : "Later"}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
