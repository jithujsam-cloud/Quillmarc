import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { SiteFooter } from "./site-footer";

// For screens outside the app shell: sign in, legal pages, opt-out.
export function PlainFrame({ children, width = "max-w-md" }: { children: React.ReactNode; width?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-line px-4 sm:px-8">
        <Link href="/" className="text-ink" aria-label="Quillmarc">
          <Wordmark className="h-[22px] w-auto" />
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className={`plain-main mx-auto w-full flex-1 px-4 pt-14 sm:px-6 sm:pt-20 ${width}`}>
        {children}
        <SiteFooter />
      </main>
      <div className="h-10" />
    </div>
  );
}
