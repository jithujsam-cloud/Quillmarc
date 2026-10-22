"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { rememberTimeZone } from "@/lib/actions/timezone";

// First visit: start from the time zone the computer is set to, then show times in it.
export function TimeZoneSync({ known }: { known: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (known) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    void rememberTimeZone(zone).then(() => router.refresh());
  }, [known, router]);
  return null;
}
