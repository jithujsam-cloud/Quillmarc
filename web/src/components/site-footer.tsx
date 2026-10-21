import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-3xl px-4 pb-10 text-[15px] text-muted sm:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6">
        <span>Quillmarc</span>
        <Link href="/privacy" className="text-muted">
          Privacy
        </Link>
        <Link href="/terms" className="text-muted">
          Terms
        </Link>
      </div>
    </footer>
  );
}
