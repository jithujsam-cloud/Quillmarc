import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import { getSetupState } from "@/lib/setup";
import { Wordmark } from "./wordmark";
import { SiteFooter } from "./site-footer";
import { NavLinks, SideNav } from "./nav-links";

// Phones and tablets: a top bar. Desktop: a quiet sidebar with the nav and the Stripe status.
export async function AppShell({ children, width = "narrow", topBar }: { children: React.ReactNode; width?: "narrow" | "wide" | "full"; topBar?: React.ReactNode }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const setup = data.user ? await getSetupState(supabase, data.user.id) : null;
  const conn = setup?.connection;
  const max = width === "full" ? "max-w-6xl" : width === "wide" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <header className="border-b border-line lg:hidden">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-ink" aria-label="Quillmarc, your updates">
            <Wordmark className="h-5 w-auto sm:h-6" />
          </Link>
          <NavLinks />
        </div>
      </header>

      <aside className="hidden border-r border-line bg-surface lg:flex lg:min-h-dvh lg:flex-col lg:px-4 lg:py-6">
        <Link href="/dashboard" className="px-2 text-ink" aria-label="Quillmarc, your updates">
          <Wordmark className="h-6 w-auto" />
        </Link>
        {setup?.profile?.company_name && <p className="mt-6 truncate px-2 text-[15px] font-medium">{setup.profile.company_name}</p>}
        <div className="mt-4">
          <SideNav investorCount={setup?.investorCount ?? 0} />
        </div>
        <div className="mt-auto border-t border-line px-2 pt-4 text-[14px]">
          {conn ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className={`size-2 rounded-full ${conn.status === "error" ? "bg-error" : "bg-ok"}`} />
                {conn.status === "error" ? "Stripe needs attention" : conn.method === "sample" ? "Sample data" : "Stripe connected"}
              </p>
              <p className="mt-1 text-muted">Read only</p>
            </>
          ) : (
            <Link href="/onboarding?step=1">Connect Stripe</Link>
          )}
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {topBar && <div className="border-b border-line bg-bg/95 lg:sticky lg:top-0 lg:z-10">{topBar}</div>}
        <main id="main" className={`mx-auto w-full flex-1 px-4 pt-10 sm:px-6 lg:px-10 ${max}`}>
          {children}
        </main>
        <SiteFooter className={`lg:px-10 ${max}`} />
      </div>
    </div>
  );
}
