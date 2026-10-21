"use client";
import { useLinkStatus } from "next/link";

// A fixed-size hint inside a <Link>: a small ring while the next screen is on its way.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={`link-spin ${pending ? "is-pending" : ""}`} />;
}
