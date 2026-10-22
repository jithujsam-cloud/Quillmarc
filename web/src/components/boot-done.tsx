"use client";
import { useEffect } from "react";

// The loading screen in the page's HTML (see layout.tsx) shows until the page is ready to use.
// This tells the stylesheet to hide it. Moving between pages never brings it back.
export function BootDone() {
  useEffect(() => {
    document.documentElement.setAttribute("data-ready", "");
  }, []);
  return null;
}
