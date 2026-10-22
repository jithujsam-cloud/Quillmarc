"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Keeps the payment import moving while the dashboard is open, then reloads the figures once.
// Each call imports a few months and returns; the server holds a lock so tabs never overlap.
export function RevenueImporter() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    async function run() {
      for (let i = 0; i < 60 && !stopped; i++) {
        try {
          const res = await fetch("/api/revenue/sync", { method: "POST" });
          const body = (await res.json()) as { complete?: boolean; busy?: boolean; error?: string | null };
          if (!res.ok || body.error) {
            if (!stopped) setFailed(true);
            return;
          }
          router.refresh();
          if (body.complete) return;
          if (body.busy) await new Promise((r) => setTimeout(r, 3000));
        } catch {
          if (!stopped) setFailed(true);
          return;
        }
      }
    }
    void run();
    return () => {
      stopped = true;
    };
  }, [router]);
  return (
    <p className={failed ? "notice" : "notice-plain"} role="status">
      {failed ? "Stripe could not be reached while importing your payment history. Reload the page to try again." : "Importing your payment history from Stripe. Older months fill in as they arrive; today's figures are already current."}
    </p>
  );
}
