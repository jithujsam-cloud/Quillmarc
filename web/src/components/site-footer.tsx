import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-faint">
      <span>Quillmarc</span>
      <Link href="/privacy" className="text-faint">
        Privacy
      </Link>
      <Link href="/terms" className="text-faint">
        Terms
      </Link>
    </footer>
  );
}
