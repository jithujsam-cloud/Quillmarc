"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Updates", match: /^\/(dashboard|updates)/ },
  { href: "/investors", label: "Investors", match: /^\/investors/ },
  { href: "/settings", label: "Settings", match: /^\/settings/ },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1 sm:gap-2">
        {LINKS.map((l) => {
          const current = l.match.test(path);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-2 text-[15px] no-underline sm:px-3 ${current ? "font-medium text-ink underline decoration-brass decoration-2 underline-offset-8" : "text-muted hover:text-ink"}`}
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
