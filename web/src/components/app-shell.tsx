import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { getSetupState } from "@/lib/setup";
import { Wordmark } from "./wordmark";
import { SideNav, SidebarToggle } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { Icon } from "./icons";
import { SiteFooter } from "./site-footer";
import { accessFor, trialLabel } from "@/lib/trial";
import { env } from "@/lib/env";

export interface Crumb {
  label: string;
  href?: string;
}

// A 232px sidebar beside the canvas, divided by a 1px rule. The sidebar folds to an icon rail
// and carries the theme switch. The way back up and what you can do here sit at the top of the canvas;
// on the phone that row becomes a bar with the menu button.
export async function AppShell({ crumbs, actions, children }: { crumbs: Crumb[]; actions?: React.ReactNode; children: React.ReactNode }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const setup = data.user ? await getSetupState(supabase, data.user.id) : null;
  const conn = setup?.connection;
  const company = setup?.profile?.company_name ?? null;
  const access = setup?.profile ? accessFor(setup.profile) : null;
  const isAdmin = Boolean(data.user?.email && env.adminEmails().includes(data.user.email.toLowerCase()));
  // The page's own heading names where you are, so the trail shows only the pages above it.
  const trail = crumbs.slice(0, -1);
  const stripeLabel = !conn ? null : conn.status === "error" ? "Stripe needs attention" : conn.method === "sample" ? "Sample Stripe data" : conn.key_mode === "test" ? "Stripe connected, test mode" : "Stripe connected";

  return (
    <div className="app">
      <aside className="app-side" aria-label="Sidebar">
        <div className="app-brand">
          <Link href="/dashboard" className="side-text text-ink" aria-label="Quillmarc, your updates">
            <Wordmark className="h-[22px] w-auto" />
          </Link>
          <SidebarToggle />
        </div>
        <p className="side-group side-text mt-4 truncate font-medium text-ink">{company ?? "Your company"}</p>
        <SideNav investorCount={setup?.investorCount ?? 0} isAdmin={isAdmin} />
        <div className="side-foot">
          {access && access.plan !== "active" && (
            <Link href="/settings#plan" className={`side-text pill no-underline ${access.expired ? "pill-warn" : "pill-accent"} w-fit`}>
              {trialLabel(access)}
            </Link>
          )}
          {stripeLabel ? (
            <Link href="/settings#stripe" className="side-item flex items-center gap-2 text-muted no-underline hover:text-ink" title={stripeLabel}>
              <span aria-hidden="true" className={`size-2 flex-none rounded-full ${conn?.status === "error" ? "bg-negative" : "bg-positive"}`} />
              <span className="side-text">{stripeLabel}</span>
              <span className="sr-only">, read only</span>
            </Link>
          ) : (
            <Link href="/onboarding?step=1" className="side-item flex items-center gap-2" title="Connect Stripe">
              <Icon name="stripe" />
              <span className="side-text">Connect Stripe</span>
            </Link>
          )}
          <ThemeToggle />
          <p className="side-text meta truncate" title={data.user?.email}>
            {data.user?.email}
          </p>
          <form action="/auth/signout" method="post">
            <button className="side-item link-btn flex items-center gap-2 text-[13px] text-muted" title="Sign out">
              <Icon name="signout" />
              <span className="side-text">Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <header className={`app-top ${trail.length || actions ? "" : "app-top-bare"}`}>
        <MobileMenu isAdmin={isAdmin} investorCount={setup?.investorCount ?? 0} email={data.user?.email ?? ""} company={company} />
        {trail.length > 0 && (
          <nav aria-label="Breadcrumb" className="crumbs min-w-0">
            {trail.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        {actions && <div className="top-actions">{actions}</div>}
      </header>

      <main id="main" className="app-canvas">
        <div className="app-canvas-inner">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}
