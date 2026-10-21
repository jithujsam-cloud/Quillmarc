"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { SideNav } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

// The phone: the sidebar becomes a full-screen sheet behind a menu button.
export function MobileMenu({ investorCount, email, company }: { investorCount: number; email: string; company: string | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="menu-btn btn btn-ghost btn-sm" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sheet-head">
            <Wordmark className="h-5 w-auto text-ink" />
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Close menu" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          {company && <p className="side-group mx-0">{company}</p>}
          <SideNav investorCount={investorCount} onNavigate={() => setOpen(false)} />
          <div className="mt-auto grid gap-4 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <p className="meta break-all">{email}</p>
            <form action="/auth/signout" method="post">
              <button className="btn btn-secondary w-full">Sign out</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
