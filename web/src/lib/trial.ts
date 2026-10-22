// The free trial rules. Pure, so they are tested without a database.

export type Plan = "trial" | "active" | "ended";

export interface Access {
  plan: Plan;
  /** Can create updates, send tests and send to investors. */
  canSend: boolean;
  /** Whole days left in the trial, rounded up. Null when not on a trial. */
  daysLeft: number | null;
  /** The trial ran out, or the owner ended access. */
  expired: boolean;
}

export const TRIAL_DAYS = 14;
const DAY = 86_400_000;

export function accessFor(p: { plan?: string | null; trial_ends_at?: string | null }, now: Date = new Date()): Access {
  const plan: Plan = p.plan === "active" || p.plan === "ended" ? p.plan : "trial";
  if (plan === "active") return { plan, canSend: true, daysLeft: null, expired: false };
  if (plan === "ended") return { plan, canSend: false, daysLeft: null, expired: true };
  const end = p.trial_ends_at ? new Date(p.trial_ends_at).getTime() : now.getTime() + TRIAL_DAYS * DAY;
  const left = end - now.getTime();
  return { plan, canSend: left > 0, daysLeft: left > 0 ? Math.ceil(left / DAY) : 0, expired: left <= 0 };
}

export function trialLabel(a: Access): string {
  if (a.plan === "active") return "Active";
  if (a.expired) return a.plan === "ended" ? "Access ended" : "Trial ended";
  return a.daysLeft === 1 ? "Free trial, 1 day left" : `Free trial, ${a.daysLeft} days left`;
}

export const TRIAL_ENDED_MESSAGE = "Your free trial has ended. Your data is safe, and you can still see everything. Sending is paused until you continue.";
