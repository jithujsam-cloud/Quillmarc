"use client";
import Link from "next/link";
import { useId, useState } from "react";

export interface TabRow {
  key: string;
  href: string;
  title: string;
  sub?: string;
  /** The figure on the right, like "5 of 6". */
  right?: string;
  /** A pill on the right in place of a figure. */
  pill?: { label: string; tone: "warn" | "quiet" | "accent" };
}

export interface Tab {
  key: string;
  label: string;
  rows: TabRow[];
  empty: string;
  /** Links under the list: "All updates", "2 open asks". */
  links: { href: string; label: string }[];
}

// A short list with tabs: a few rows to glance at, and a link to the full page.
export function ActivityTabs({ tabs, title }: { tabs: Tab[]; title: string }) {
  const [active, setActive] = useState(tabs[0].key);
  const id = useId();
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <section className="panel topic-panel topic-money flex flex-col" aria-labelledby={`${id}-h`}>
      <div className="panel-head">
        <h2 id={`${id}-h`}>
          <span className="topic-dot" aria-hidden="true" />
          {title}
        </h2>
      </div>
      <div className="tabs px-5" role="tablist" aria-label={title}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" id={`${id}-${t.key}`} aria-selected={t.key === active} aria-controls={`${id}-panel`} aria-current={t.key === active ? "true" : undefined} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab.key}`} className="flex flex-1 flex-col">
        {tab.rows.length === 0 ? (
          <p className="flex-1 px-5 py-6 text-muted">{tab.empty}</p>
        ) : (
          <ul className="tab-scroll" tabIndex={0} aria-label={`${tab.label}, scrollable list`}>
            {tab.rows.map((r) => (
              <li key={r.key} className="border-b border-rule last:border-b-0">
                <Link href={r.href} className="tab-row">
                  <span className="min-w-0">
                    <span className="block truncate">{r.title}</span>
                    {r.sub && <span className="stat-hint truncate">{r.sub}</span>}
                  </span>
                  {r.pill ? <span className={`pill ${r.pill.tone === "warn" ? "pill-warn" : r.pill.tone === "accent" ? "pill-accent" : "pill-quiet"}`}>{r.pill.label}</span> : <span className="tab-figure">{r.right}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3">
          {tab.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="card-link">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
