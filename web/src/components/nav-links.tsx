"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { LinkPending } from "./link-pending";

const LINKS = [
  { href: "/dashboard", label: "Updates", match: /^\/(dashboard|updates)/, icon: "updates" as const },
  { href: "/investors", label: "Investors", match: /^\/investors/, icon: "investors" as const },
  { href: "/settings", label: "Settings", match: /^\/(settings|onboarding)/, icon: "settings" as const },
];

export function SideNav({ investorCount, onNavigate }: { investorCount: number; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate} aria-current={l.match.test(path) ? "page" : undefined}>
          <Icon name={l.icon} />
          <span>{l.label}</span>
          <span className="ml-auto flex items-center gap-2">
            <LinkPending />
          </span>
          {l.href === "/investors" && investorCount > 0 && (
            <span className="count" aria-label={`${investorCount} investors`}>
              {investorCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
