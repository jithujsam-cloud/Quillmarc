"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps the send queue moving while this page is open, then keeps statuses fresh.
export function QueueRunner({ id, pending }: { id: string; pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (stopped) return;
      if (pending) {
        try {
          await fetch(`/api/updates/${id}/process`, { method: "POST" });
        } catch {}
      }
      router.refresh();
      timer = setTimeout(tick, pending ? 1500 : 20000);
    }
    timer = setTimeout(tick, pending ? 300 : 20000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, pending, router]);
  return null;
}
