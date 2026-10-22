import { describe, expect, it } from "vitest";
import { accessFor, trialLabel } from "@/lib/trial";

const now = new Date("2026-10-22T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe("accessFor", () => {
  it("lets a trial send until it ends, counting whole days left", () => {
    expect(accessFor({ plan: "trial", trial_ends_at: inDays(14) }, now)).toEqual({ plan: "trial", canSend: true, daysLeft: 14, expired: false });
    expect(accessFor({ plan: "trial", trial_ends_at: inDays(0.2) }, now).daysLeft).toBe(1);
  });

  it("stops sending once the trial is over", () => {
    expect(accessFor({ plan: "trial", trial_ends_at: inDays(-1) }, now)).toEqual({ plan: "trial", canSend: false, daysLeft: 0, expired: true });
  });

  it("active accounts always send; ended accounts never do", () => {
    expect(accessFor({ plan: "active", trial_ends_at: inDays(-30) }, now).canSend).toBe(true);
    expect(accessFor({ plan: "ended", trial_ends_at: inDays(30) }, now).canSend).toBe(false);
  });

  it("treats an unknown plan as a trial", () => {
    expect(accessFor({ plan: "weird", trial_ends_at: inDays(3) }, now).plan).toBe("trial");
  });

  it("labels the state in plain words", () => {
    expect(trialLabel(accessFor({ plan: "trial", trial_ends_at: inDays(1) }, now))).toBe("Free trial, 1 day left");
    expect(trialLabel(accessFor({ plan: "trial", trial_ends_at: inDays(-1) }, now))).toBe("Trial ended");
    expect(trialLabel(accessFor({ plan: "active" }, now))).toBe("Active");
  });
});
