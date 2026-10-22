"use client";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "qm-theme"; // shared with the marketing site; restored before first paint by layout.tsx

const OPTIONS: { value: Theme; label: string; path: string }[] = [
  { value: "light", label: "Light", path: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" },
  { value: "dark", label: "Dark", path: "M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" },
  { value: "system", label: "Match system", path: "M2 3.5h12v8H2zM6 14h4M8 11.5V14" },
];

// The theme lives on <html data-theme>. Every switch on the page reads it from there.
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function snapshot(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => null);

  function choose(t: Theme) {    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={theme === o.value} aria-label={`${o.label} theme`} title={`${o.label} theme`} onClick={() => choose(o.value)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={o.path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
