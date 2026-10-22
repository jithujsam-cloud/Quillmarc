// The hosted update: the letter investors read. The serif leads here and nowhere else.
import type { UpdateContent } from "@/lib/email/render";
import { BULLET_GROUPS, compareText, coverLine } from "@/lib/email/render";
import type { MetricWarning } from "@/lib/metrics";

export function UpdateDocument({ content, greetingName, warnings = [] }: { content: UpdateContent; greetingName?: string; warnings?: MetricWarning[] }) {
  const groups = BULLET_GROUPS.map((g) => ({ ...g, items: content.bullets[g.key].filter(Boolean) })).filter((g) => g.items.length);
  // Currency and price exclusions change what MRR covers, so investors see them too.
  const shown = warnings.filter((w) => w.code === "multi_currency" || w.code === "metered_excluded" || w.code === "tiered_excluded");
  const [lead, ...rest] = content.figures;
  return (
    <article className="letter grid gap-10">
      <header>
        <p className="font-sans text-muted">{content.companyName}</p>
        <h1 className="mt-2 text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px]">Investor update, {content.periodLabel}</h1>
        <p className="mt-2 font-sans text-muted">Covers {coverLine(content)}</p>
        {greetingName && <p className="letter-body mt-6">Hi {greetingName}, here is where {content.companyName} stands for {content.periodLabel}.</p>}
        {content.sample && (
          <p className="notice mt-6 font-sans">
            <strong>Sample data.</strong> These figures are fictional and come from the demo account.
          </p>
        )}
      </header>

      <section aria-labelledby="numbers" className="font-sans">
        <h2 id="numbers" className="mb-4 text-[24px] leading-[30px]">
          Key numbers
        </h2>
        <div className="panel overflow-hidden">
          <dl className="border-b border-line p-5">
            <div>
              <dt className="text-[13px] text-muted">{lead.label}</dt>
              <dd className="mt-1 text-[36px] font-medium leading-[42px] tracking-tight">{lead.display}</dd>
              {lead.compare && <dd className="mt-1 text-[13px] text-muted">{compareText(lead)}</dd>}
              {lead.adjusted && (
                <dd className="mt-2">
                  <span className="pill pill-accent">Adjusted by founder</span>
                </dd>
              )}
            </div>
          </dl>
          <dl className="grid grid-cols-2 sm:grid-cols-3">
            {rest.map((f, i) => (
              <div key={f.key} className={`border-line p-5 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t" : ""} sm:border-l sm:border-t-0 sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(n+4)]:border-t`}>
                <dt className="text-[13px] text-muted">{f.label}</dt>
                <dd className="mt-1 text-[22px] font-medium leading-[28px]">{f.display}</dd>
                {f.compare && <dd className="mt-1 text-[12px] text-faint">{compareText(f)}</dd>}
                {(f.adjusted || f.estimated) && <dd className="mt-1 text-[12px] text-faint">{f.adjusted ? "Adjusted by founder" : "Estimated"}</dd>}
              </div>
            ))}
          </dl>
        </div>
        <p className="hint mt-3">From Stripe. Last {content.noun} is rebuilt from subscription dates at today&apos;s prices, so it and growth are estimates.</p>
        {shown.map((w) => (
          <p key={w.code} className="hint mt-1">
            {w.message}
          </p>
        ))}
      </section>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`g-${g.key}`}>
          <h2 id={`g-${g.key}`} className="text-[26px] leading-[32px]">
            {g.label}
          </h2>
          <ul className="letter-body mt-3 grid list-disc gap-2 pl-6">
            {g.items.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="letter-body border-t border-line pt-6">
        <p>{content.founderName}</p>
        <p className="text-muted">{content.companyName}</p>
      </footer>
    </article>
  );
}
