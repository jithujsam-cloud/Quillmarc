"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icon } from "./icons";
import { LinkPending } from "./link-pending";

const LINKS = [
  { href: "/dashboard", label: "Updates", match: /^\/(dashboard|updates)/, icon: "updates" as const },
  { href: "/investors", label: "Investors", match: /^\/investors/, icon: "investors" as const },
  { href: "/settings", label: "Settings", match: /^\/(settings|onboarding)/, icon: "settings" as const },
];

export function SideNav({ investorCount, onNavigate, isAdmin = false }: { investorCount: number; onNavigate?: () => void; isAdmin?: boolean }) {
  const path = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Accounts", match: /^\/admin/, icon: "investors" as const }] : LINKS;
  return (
    <nav aria-label="Main" className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate} aria-current={l.match.test(path) ? "page" : undefined} title={l.label}>
          <Icon name={l.icon} />
          <span className="side-text">{l.label}</span>
          <span className="side-text ml-auto flex items-center gap-2">
            <LinkPending />
          </span>
          {l.href === "/investors" && investorCount > 0 && (
            <span className="count side-text" aria-label={`${investorCount} investors`}>
              {investorCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

const SIDEBAR_KEY = "qm-sidebar"; // restored before first paint by layout.tsx

// Folds the desktop sidebar to an icon rail. The state lives on <html data-sidebar>.
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar"] });
  return () => mo.disconnect();
}
const isCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "collapsed";

export function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);

  function toggle() {
    const next = !collapsed;
    if (next) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, "collapsed");
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {}
  }

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button type="button" className="side-toggle btn btn-ghost btn-sm" aria-label={label} title={label} aria-expanded={!collapsed} onClick={toggle}>
      <Icon name="sidebar" />
    </button>
  );
}
