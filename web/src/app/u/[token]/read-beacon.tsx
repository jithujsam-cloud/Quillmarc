"use client";
import { useEffect } from "react";

// Logs the read from the browser after the page loads. Link scanners that fetch the page
// without running scripts do not count as a read.
export function ReadBeacon({ token }: { token: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), keepalive: true }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [token]);
  return null;
}
