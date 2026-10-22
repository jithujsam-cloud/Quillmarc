import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { getSetupState } from "@/lib/setup";
import { Mark, Wordmark } from "./wordmark";
import { AccountMenu, SideNav } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { SiteFooter } from "./site-footer";
import { accessFor, trialLabel } from "@/lib/trial";
import { env } from "@/lib/env";
import { getTimeZone } from "@/lib/timezone-server";
import { TimeZoneSync } from "./timezone-sync";

export interface Crumb {
  label: string;
  href?: string;
}

// The frame every signed-in page shares, rendered once by app/(app)/layout.tsx so it stays put
// while pages change. A 232px sidebar beside the canvas, divided by a 1px rule. The sidebar folds
// to a 64px icon rail and opens over the canvas on hover. Every row keeps its height when it folds,
// so nothing moves up or down; labels only fade. On the phone a bar with the menu button replaces it.
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const tz = await getTimeZone();
  const setup = data.user ? await getSetupState(supabase, data.user.id) : null;
  const conn = setup?.connection;
  const company = setup?.profile?.company_name ?? null;
  const access = setup?.profile ? accessFor(setup.profile) : null;
  const isAdmin = Boolean(data.user?.email && env.adminEmails().includes(data.user.email.toLowerCase()));
  const stripeLabel = !conn ? null : conn.status === "error" ? "Stripe needs attention" : conn.method === "sample" ? "Sample Stripe data" : conn.key_mode === "test" ? "Stripe connected, test mode" : "Stripe connected";

  return (
    <div className="app">
      {data.user && <TimeZoneSync known={tz.known} />}
      <aside className="app-side" aria-label="Sidebar">
        <div className="side-panel">
          <Link href="/dashboard" className="app-brand" aria-label="Quillmarc, your updates">
            <Wordmark className="brand-word h-[22px] w-auto" />
            <Mark className="brand-mark size-6" />
          </Link>
          <p className="side-group side-text truncate font-medium text-ink">{company ?? "Your company"}</p>
          <SideNav investorCount={setup?.investorCount ?? 0} isAdmin={isAdmin} />
          <AccountMenu
            email={data.user?.email ?? ""}
            stripe={stripeLabel ? { label: stripeLabel, error: conn?.status === "error" } : null}
            plan={access && access.plan !== "active" ? { label: trialLabel(access), expired: access.expired } : null}
          />
        </div>
      </aside>

      <header className="app-phonebar">
        <MobileMenu isAdmin={isAdmin} investorCount={setup?.investorCount ?? 0} email={data.user?.email ?? ""} company={company} />
        <Link href="/dashboard" className="text-ink" aria-label="Quillmarc, your updates">
          <Wordmark className="h-5 w-auto" />
        </Link>
      </header>

      <main id="main" className="app-canvas">
        {children}
      </main>
    </div>
  );
}

// One page inside the frame: the way back up and what you can do here, then the page.
// The page's own heading names where you are, so the trail shows only the pages above it.
export function AppShell({ crumbs, actions, children }: { crumbs: Crumb[]; actions?: React.ReactNode; children: React.ReactNode }) {
  const trail = crumbs.slice(0, -1);
  return (
    <>
      {(trail.length > 0 || actions) && (
        <div className="app-top">
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
        </div>
      )}
      <div className="app-canvas-inner">{children}</div>
      <SiteFooter />
    </>
  );
}
