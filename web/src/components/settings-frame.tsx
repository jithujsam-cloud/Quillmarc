import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TitleRow } from "@/components/title-row";

const TABS = [
  { key: "account", href: "/settings", label: "Account" },
  { key: "stripe", href: "/settings/stripe", label: "Stripe" },
  { key: "plan", href: "/settings/plan", label: "Plan" },
  { key: "data", href: "/settings/data", label: "Your data" },
] as const;

export type SettingsTab = (typeof TABS)[number]["key"];

// Settings are a few short pages, not one long one: pick the part you want from the tabs.
export function SettingsFrame({ tab, email, children }: { tab: SettingsTab; email?: string; children: React.ReactNode }) {
  return (
    <AppShell crumbs={[{ label: "Settings" }]}>
      <TitleRow title="Settings" sub={email ? <>Signed in as {email}</> : undefined} />
      <nav aria-label="Settings" className="tabs mb-6">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="max-w-[1040px]">{children}</div>
    </AppShell>
  );
}

export function Setting({ id, title, desc, children }: { id: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="setting" aria-labelledby={`${id}-h`} id={id}>
      <div>
        <h2 id={`${id}-h`}>{title}</h2>
        <div className="desc">{desc}</div>
      </div>
      <div className="setting-panel">{children}</div>
    </section>
  );
}
