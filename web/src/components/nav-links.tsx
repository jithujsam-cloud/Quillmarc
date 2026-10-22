"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { LinkPending } from "./link-pending";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", match: /^\/dashboard/, icon: "dashboard" as const },
  { href: "/updates", label: "Updates", match: /^\/updates/, icon: "updates" as const },
  { href: "/investors", label: "Investors", match: /^\/investors/, icon: "investors" as const },
  { href: "/asks", label: "Asks", match: /^\/asks/, icon: "asks" as const },
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

export function SidebarToggle({ onDone }: { onDone?: () => void }) {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !collapsed;
    const root = document.documentElement;
    if (next) {
      root.setAttribute("data-sidebar", "collapsed");
      // The pointer is still over the sidebar; hold off the hover peek until it leaves, or folding looks like it did nothing.
      const panel = document.querySelector(".side-panel");
      if (panel && e.detail > 0) {
        root.setAttribute("data-peek", "off");
        panel.addEventListener("mouseleave", () => root.removeAttribute("data-peek"), { once: true });
      }
    } else {
      root.removeAttribute("data-sidebar");
    }
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, "collapsed");
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {}
    onDone?.();
  }

  return (
    <button type="button" className="acct-item" onClick={toggle}>
      <Icon name="sidebar" />
      <span className="truncate">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
    </button>
  );
}

// The account row at the foot of the sidebar. Its menu floats above the row through a portal, so the
// folded rail never clips it and the theme switch stays put while the pointer is over the menu.
export function AccountMenu({
  email,
  stripe,
  plan,
}: {
  email: string;
  stripe: { label: string; error: boolean } | null;
  plan: { label: string; expired: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const attention = stripe?.error || plan?.expired;

  return (
    <div className="side-foot">
      <button ref={button} type="button" className="acct-btn" aria-expanded={open} title={email} onClick={() => setOpen((o) => !o)}>
        <span className="acct-avatar" aria-hidden="true">
          {email.charAt(0).toUpperCase()}
          {attention && <span className="acct-alert" />}
        </span>
        <span className="acct-email side-text">{email}</span>
        <span className="side-text acct-chevron" aria-hidden="true">
          <Icon name="updown" />
        </span>
      </button>
      {open &&
        createPortal(
          <div ref={menu} className="acct-menu">
            <p className="acct-head" title={email}>
              {email}
            </p>
            {plan && (
              <Link href="/settings#plan" className={`acct-item ${plan.expired ? "text-negative" : "text-accent-ink"}`} onClick={close}>
                <Icon name="clock" />
                <span className="truncate">{plan.label}</span>
              </Link>
            )}
            {stripe ? (
              <Link href="/settings#stripe" className="acct-item" onClick={close}>
                <span className="grid size-4 flex-none place-items-center" aria-hidden="true">
                  <span className={`size-2 rounded-full ${stripe.error ? "bg-negative" : "bg-positive"}`} />
                </span>
                <span className="truncate">{stripe.label}</span>
              </Link>
            ) : (
              <Link href="/onboarding?step=1" className="acct-item" onClick={close}>
                <Icon name="stripe" />
                <span className="truncate">Connect Stripe</span>
              </Link>
            )}
            <div className="acct-sep" />
            <div className="acct-item acct-theme">
              <span className="text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <SidebarToggle onDone={close} />
            <div className="acct-sep" />
            <form action="/auth/signout" method="post">
              <button className="acct-item">
                <Icon name="signout" />
                <span className="truncate">Sign out</span>
              </button>
            </form>
          </div>,
          document.body,
        )}
    </div>
  );
}
