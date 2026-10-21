// The hosted update: metrics with their labels, then the bullets. Used by /u/[token] and the preview.
import type { UpdateContent } from "@/lib/email/render";
import { BULLET_GROUPS } from "@/lib/email/render";
import type { MetricWarning } from "@/lib/metrics";

export function UpdateDocument({ content, greetingName, warnings = [] }: { content: UpdateContent; greetingName?: string; warnings?: MetricWarning[] }) {
  const groups = BULLET_GROUPS.map((g) => ({ ...g, items: content.bullets[g.key].filter(Boolean) })).filter((g) => g.items.length);
  // Currency exclusions change what MRR covers, so investors see them too.
  const shown = warnings.filter((w) => w.code === "multi_currency" || w.code === "metered_excluded" || w.code === "tiered_excluded");
  return (
    <article className="space-y-10">
      <header>
        <p className="text-muted">{content.companyName}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Investor update, {content.monthLabel}</h1>
        <hr className="rule-brass mt-6" />
        {greetingName && <p className="mt-6">Hi {greetingName}, here is where {content.companyName} stands.</p>}
        {content.sample && (
          <p className="notice mt-6">
            <strong>Sample data.</strong> These figures are fictional and come from the demo account.
          </p>
        )}
      </header>

      <section aria-labelledby="numbers">
        <h2 id="numbers" className="text-3xl">
          Key numbers
        </h2>
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {content.figures.map((f) => (
            <div key={f.key} className="card p-4">
              <dt className="text-[15px] text-muted">{f.label}</dt>
              <dd className="num mt-1 text-3xl">{f.display}</dd>
              {(f.adjusted || f.estimated) && (
                <dd className="mt-2 flex flex-wrap gap-2">
                  {f.adjusted && <span className="badge">Adjusted by founder</span>}
                  {f.estimated && !f.adjusted && <span className="badge badge-quiet">Estimated</span>}
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="hint mt-3">From Stripe. Last month is rebuilt from subscription dates at today&apos;s prices, so it and the growth figures are estimates.</p>
        {shown.map((w) => (
          <p key={w.code} className="hint mt-2">
            {w.message}
          </p>
        ))}
      </section>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`g-${g.key}`}>
          <h2 id={`g-${g.key}`} className="text-3xl">
            {g.label}
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            {g.items.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="border-t border-line pt-6">
        <p>{content.founderName}</p>
        <p className="text-muted">{content.companyName}</p>
      </footer>
    </article>
  );
}
