import Link from "next/link";
import { Wordmark } from "./wordmark";
import { SiteFooter } from "./site-footer";

export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <Link href="/" className="text-ink" aria-label="Quillmarc">
            <Wordmark className="h-6 w-auto" />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-12 sm:px-6">
        <article className="space-y-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">{children}</article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function ContactLink({ email }: { email: string }) {
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>the address in your welcome email</>;
}
