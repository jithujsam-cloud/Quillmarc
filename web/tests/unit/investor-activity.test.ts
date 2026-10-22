import { describe, expect, it } from "vitest";
import { activityFor, type InvestorSend } from "@/lib/investor-activity";

const now = new Date("2026-10-22T12:00:00Z");
const send = (sentAt: string, readAt: string | null = null, delivered = true): InvestorSend => ({ updateId: sentAt, sentAt, delivered, readAt });

describe("who has gone quiet", () => {
  it("is quiet after missing the last two updates", () => {
    const a = activityFor([send("2026-08-04T09:00:00Z", "2026-08-05T09:00:00Z"), send("2026-09-04T09:00:00Z"), send("2026-10-04T09:00:00Z")], now);
    expect(a).toMatchObject({ received: 3, read: 1, missedInARow: 2, quiet: true, lastReadAt: "2026-08-05T09:00:00Z" });
  });

  it("is not quiet after missing only the newest", () => {
    const a = activityFor([send("2026-09-04T09:00:00Z", "2026-09-05T09:00:00Z"), send("2026-10-04T09:00:00Z")], now);
    expect(a).toMatchObject({ missedInARow: 1, quiet: false });
  });

  it("starts counting again after a read", () => {
    const a = activityFor([send("2026-08-04T09:00:00Z"), send("2026-09-04T09:00:00Z", "2026-09-04T10:00:00Z"), send("2026-10-04T09:00:00Z")], now);
    expect(a).toMatchObject({ missedInARow: 1, quiet: false });
  });

  it("gives an update a few days before it counts as missed", () => {
    const a = activityFor([send("2026-09-04T09:00:00Z"), send("2026-10-21T09:00:00Z")], now);
    expect(a.missedInARow).toBe(1); // yesterday's update is too new to count
    expect(a.quiet).toBe(false);
  });

  it("does not count an update that never reached them", () => {
    const a = activityFor([send("2026-08-04T09:00:00Z"), send("2026-09-04T09:00:00Z", null, false), send("2026-10-04T09:00:00Z", null, false)], now);
    expect(a).toMatchObject({ received: 1, missedInARow: 1, quiet: false });
  });

  it("is not quiet with nothing sent yet", () => {
    expect(activityFor([], now)).toEqual({ received: 0, read: 0, lastReadAt: null, missedInARow: 0, quiet: false });
  });

  it("reports the latest read, whichever update it was", () => {
    const a = activityFor([send("2026-09-04T09:00:00Z", "2026-10-10T09:00:00Z"), send("2026-08-04T09:00:00Z", "2026-08-06T09:00:00Z")], now);
    expect(a.lastReadAt).toBe("2026-10-10T09:00:00Z");
  });
});
