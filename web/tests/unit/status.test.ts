import { describe, expect, it } from "vitest";
import { deriveStatus, totals, type StatusEvent, type StatusInput } from "@/lib/sending/status";

const base: StatusInput = { sendStatus: "sent", sentAt: "2026-10-02T09:00:00Z", createdAt: "2026-10-02T08:59:00Z", events: [], investorOptedOut: false };
const ev = (type: StatusEvent["type"], occurredAt: string): StatusEvent => ({ type, occurredAt });
const d = (events: StatusEvent[], extra: Partial<StatusInput> = {}) => deriveStatus({ ...base, ...extra, events });

describe("deriveStatus", () => {
  it("walks queued, sent, delivered, opened, read", () => {
    expect(d([], { sendStatus: "queued", sentAt: null }).status).toBe("queued");
    expect(d([]).status).toBe("sent");
    expect(d([ev("delivered", "2026-10-02T09:00:03Z")]).status).toBe("delivered");
    expect(d([ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T10:00:00Z")]).status).toBe("opened");
    expect(d([ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T10:00:00Z"), ev("read", "2026-10-02T10:01:00Z")]).status).toBe("read");
  });

  it("lets read beat opened even when the open arrives later", () => {
    expect(d([ev("read", "2026-10-02T10:00:00Z"), ev("opened", "2026-10-02T11:00:00Z")]).status).toBe("read");
  });

  it("flags opens within 10 seconds of delivery as possibly automatic", () => {
    const r = d([ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T09:00:08Z")]);
    expect(r.status).toBe("opened");
    expect(r.possiblyAutomatic).toBe(true);
    const later = d([ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T09:00:08Z"), ev("opened", "2026-10-02T12:00:00Z")]);
    expect(later.possiblyAutomatic).toBe(false);
    const clicked = d([ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T09:00:05Z"), ev("clicked", "2026-10-02T09:00:06Z")]);
    expect(clicked.possiblyAutomatic).toBe(false);
  });

  it("puts problems and opt-outs first", () => {
    expect(d([ev("delivered", "2026-10-02T09:00:03Z"), ev("bounced", "2026-10-02T09:00:04Z")]).status).toBe("bounced");
    expect(d([ev("read", "2026-10-02T10:00:00Z"), ev("complained", "2026-10-02T11:00:00Z")]).status).toBe("complained");
    expect(d([ev("read", "2026-10-02T10:00:00Z")], { investorOptedOut: true }).status).toBe("opted_out");
    expect(d([ev("opted_out", "2026-10-02T10:00:00Z")]).status).toBe("opted_out");
  });

  it("reports failures, delays and the last event time", () => {
    expect(d([], { sendStatus: "failed", sentAt: null }).status).toBe("failed");
    const r = d([ev("delivery_delayed", "2026-10-02T09:05:00Z")]);
    expect(r.status).toBe("sent");
    expect(r.delayed).toBe(true);
    expect(r.lastEventAt).toBe("2026-10-02T09:05:00.000Z");
  });
});

describe("totals", () => {
  it("counts the funnel", () => {
    const rows = [
      [ev("delivered", "2026-10-02T09:00:03Z")],
      [ev("delivered", "2026-10-02T09:00:03Z"), ev("opened", "2026-10-02T09:00:05Z")],
      [ev("delivered", "2026-10-02T09:00:03Z"), ev("read", "2026-10-02T10:00:00Z")],
      [ev("bounced", "2026-10-02T09:00:04Z")],
    ].map((events) => ({ events, sendStatus: "sent" as const, derived: d(events) }));
    expect(totals(rows)).toMatchObject({ recipients: 4, sent: 4, delivered: 3, opened: 2, openedPossiblyAutomatic: 1, read: 1, bounced: 1 });
  });
});
