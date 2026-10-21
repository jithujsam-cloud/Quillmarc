import Link from "next/link";
import { Wordmark } from "./wordmark";
import { SiteFooter } from "./site-footer";
import { NavLinks } from "./nav-links";

export function AppShell({ children, width = "narrow" }: { children: React.ReactNode; width?: "narrow" | "wide" }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-ink" aria-label="Quillmarc, your updates">
            <Wordmark className="h-6 w-auto" />
          </Link>
          <NavLinks />
        </div>
      </header>
      <main id="main" className={`mx-auto w-full flex-1 px-4 pt-10 sm:px-6 ${width === "wide" ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
