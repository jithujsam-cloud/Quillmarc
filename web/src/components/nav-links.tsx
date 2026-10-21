"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Updates", match: /^\/(dashboard|updates)/, icon: "M3 4h10M3 8h10M3 12h6" },
  { href: "/investors", label: "Investors", match: /^\/investors/, icon: "M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5M10.5 3.8a2.3 2.3 0 0 1 0 4.4M12.2 10.3c1.1.5 1.9 1.6 2.3 3.2" },
  { href: "/settings", label: "Settings", match: /^\/settings/, icon: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center sm:gap-2">
        {LINKS.map((l) => {
          const current = l.match.test(path);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-1.5 text-[15px] no-underline sm:px-3 ${current ? "font-medium text-ink underline decoration-brass decoration-2 underline-offset-8" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav({ investorCount }: { investorCount: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {LINKS.map((l) => {
          const current = l.match.test(path);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-2 text-[15px] no-underline ${current ? "border border-line bg-bg font-medium text-ink" : "border border-transparent text-muted hover:bg-tint hover:text-ink"}`}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0">
                  <path d={l.icon} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="flex-1">{l.label}</span>
                {l.href === "/investors" && investorCount > 0 && <span className="num text-[13px] text-muted">{investorCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
