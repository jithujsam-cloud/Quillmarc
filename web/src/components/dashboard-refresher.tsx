"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// The dashboard opens with what is already saved. This brings it up to date from Stripe in the
// background, reloads the figures once, then keeps importing older payments until they are all in.
export function DashboardRefresher({ hasData, importing }: { hasData: boolean; importing: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"working" | "importing" | "done">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const post = async (url: string) => {
      const res = await fetch(url, { method: "POST" });
      return (await res.json().catch(() => ({}))) as { complete?: boolean; busy?: boolean; error?: string | null };
    };
    async function run() {
      try {
        const first = await post("/api/dashboard/refresh");
        if (stopped) return;
        if (first.error) {
          setError(first.error);
          setPhase("done");
          router.refresh();
          return;
        }
        router.refresh();
        let complete = first.complete !== false;
        setPhase(complete ? "done" : "importing");
        for (let i = 0; i < 60 && !complete && !stopped; i++) {
          const next = await post("/api/revenue/sync");
          if (next.error) {
            setError(next.error);
            break;
          }
          router.refresh();
          complete = next.complete === true;
          if (next.busy) await new Promise((r) => setTimeout(r, 3000));
        }
      } catch {
        if (!stopped) setError("Stripe could not be reached just now. The figures shown are the last saved ones.");
      }
      if (!stopped) setPhase("done");
    }
    void run();
    return () => {
      stopped = true;
    };
  }, [router]);

  if (error) {
    return (
      <p className="notice" role="status">
        {error}
      </p>
    );
  }
  if (phase === "working" && !hasData) {
    return (
      <p className="notice-plain" role="status">
        Reading your Stripe data. This takes a few seconds the first time.
      </p>
    );
  }
  if (phase === "importing" || (phase === "working" && importing && hasData)) {
    return (
      <p className="notice-plain" role="status">
        Importing your payment history from Stripe. Older months fill in as they arrive; today&apos;s figures are already current.
      </p>
    );
  }
  return null;
}
