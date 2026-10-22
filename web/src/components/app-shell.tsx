import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { getSetupState } from "@/lib/setup";
import { Wordmark } from "./wordmark";
import { SideNav } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { SiteFooter } from "./site-footer";
import { accessFor, trialLabel } from "@/lib/trial";
import { env } from "@/lib/env";

export interface Crumb {
  label: string;
  href?: string;
}

// Ruled T-frame: a 232px sidebar and a 64px top bar on one ground, divided by 1px rules.
// The top bar carries where you are and what you can do here.
export async function AppShell({ crumbs, actions, children }: { crumbs: Crumb[]; actions?: React.ReactNode; children: React.ReactNode }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const setup = data.user ? await getSetupState(supabase, data.user.id) : null;
  const conn = setup?.connection;
  const company = setup?.profile?.company_name ?? null;
  const access = setup?.profile ? accessFor(setup.profile) : null;
  const isAdmin = Boolean(data.user?.email && env.adminEmails().includes(data.user.email.toLowerCase()));
  const stripeLabel = !conn ? null : conn.status === "error" ? "Stripe needs attention" : conn.method === "sample" ? "Sample Stripe data" : conn.key_mode === "test" ? "Stripe connected, test mode" : "Stripe connected";

  return (
    <div className="app">
      <aside className="app-side" aria-label="Sidebar">
        <Link href="/dashboard" className="app-brand" aria-label="Quillmarc, your updates">
          <Wordmark className="h-[22px] w-auto" />
        </Link>
        <p className="side-group mt-4 truncate font-medium text-ink">{company ?? "Your company"}</p>
        <SideNav investorCount={setup?.investorCount ?? 0} isAdmin={isAdmin} />
        <div className="side-foot">
          {access && access.plan !== "active" && (
            <Link href="/settings#plan" className={`pill no-underline ${access.expired ? "pill-warn" : "pill-accent"} w-fit`}>
              {trialLabel(access)}
            </Link>
          )}
          {stripeLabel ? (
            <Link href="/settings#stripe" className="flex items-center gap-2 text-muted no-underline hover:text-ink">
              <span aria-hidden="true" className={`size-2 rounded-full ${conn?.status === "error" ? "bg-negative" : "bg-positive"}`} />
              {stripeLabel}
              <span className="sr-only">, read only</span>
            </Link>
          ) : (
            <Link href="/onboarding?step=1">Connect Stripe</Link>
          )}
          <p className="meta truncate" title={data.user?.email}>
            {data.user?.email}
          </p>
          <form action="/auth/signout" method="post">
            <button className="link-btn text-[13px] text-muted">Sign out</button>
          </form>
        </div>
      </aside>

      <header className="app-top">
        <MobileMenu isAdmin={isAdmin} investorCount={setup?.investorCount ?? 0} email={data.user?.email ?? ""} company={company} />
        <nav aria-label="Breadcrumb" className="crumbs min-w-0">
          {crumbs.map((c, i) => (
            <span key={i} className="flex min-w-0 items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="top-actions">
          {actions}
          <span className="top-divider hide-phone" aria-hidden="true" />
          <span className="hide-phone">
            <ThemeToggle />
          </span>
        </div>
      </header>

      <main id="main" className="app-canvas">
        <div className="app-canvas-inner">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}
