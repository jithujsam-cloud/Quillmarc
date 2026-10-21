import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";
import { adminClient, connect, hasDb } from "./db";
import { seedFounder } from "./helpers";
import { MockProvider, type MockMessage } from "@/lib/email/provider";
import { enqueueSends, processQueue, sendTest } from "@/lib/sending/queue";
import { ingestResendEvent } from "@/lib/webhooks/resend";
import { optOut, recordRead } from "@/lib/tracking";
import { deriveStatus } from "@/lib/sending/status";

const fixture = (type: string, emailId: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/resend", `${type}.json`), "utf8").replace("__EMAIL_ID__", emailId));

describe.skipIf(!hasDb)("webhooks and tracking", () => {
  let db: pg.Client;
  const admin = hasDb ? adminClient() : (null as never);
  let f: Awaited<ReturnType<typeof seedFounder>>;
  let sends: { id: string; investor_id: string; resend_message_id: string; token: string; investor_email: string }[];

  beforeAll(async () => {
    db = await connect();
    f = await seedFounder(db, "hook");
    const box: MockMessage[] = [];
    const cfg = { appUrl: "https://app.example.com", sendingDomain: "updates.example.com", provider: new MockProvider(box), delayMs: 0, sleep: async () => {} };
    await sendTest(admin, cfg, f.updateId);
    await enqueueSends(admin, f.updateId);
    await processQueue(admin, cfg, f.updateId);
    sends = (await db.query("select id, investor_id, resend_message_id, token, investor_email from sends where update_id = $1 order by investor_email", [f.updateId])).rows;
  });
  afterAll(async () => {
    await db.end();
  });

  async function statusOf(sendId: string) {
    const s = (await db.query("select s.status, s.sent_at, s.created_at, i.opted_out from sends s join investors i on i.id = s.investor_id where s.id = $1", [sendId])).rows[0];
    const events = (await db.query("select type, occurred_at from events where send_id = $1", [sendId])).rows;
    return deriveStatus({
      sendStatus: s.status, sentAt: s.sent_at?.toISOString() ?? null, createdAt: s.created_at.toISOString(), investorOptedOut: s.opted_out,
      events: events.map((e) => ({ type: e.type, occurredAt: e.occurred_at.toISOString() })),
    });
  }

  it("stores each event type from the recorded payloads", async () => {
    const s = sends[0];
    for (const type of ["email.sent", "email.delivered", "email.delivery_delayed", "email.opened", "email.clicked"]) {
      expect(await ingestResendEvent(admin, fixture(type, s.resend_message_id), `msg_${type}_${s.id}`)).toBe("stored");
    }
    const { rows } = await db.query("select type from events where send_id = $1 order by occurred_at", [s.id]);
    expect(rows.map((r) => r.type)).toEqual(["sent", "delivered", "opened", "delivery_delayed", "clicked"]);
    expect((await statusOf(s.id)).status).toBe("opened");
  });

  it("deduplicates on svix-id", async () => {
    const s = sends[1];
    const p = fixture("email.delivered", s.resend_message_id);
    expect(await ingestResendEvent(admin, p, `dup_${s.id}`)).toBe("stored");
    expect(await ingestResendEvent(admin, p, `dup_${s.id}`)).toBe("duplicate");
    const { rows } = await db.query("select count(*)::int n from events where send_id = $1", [s.id]);
    expect(rows[0].n).toBe(1);
  });

  it("ignores unknown types and unknown messages", async () => {
    expect(await ingestResendEvent(admin, { type: "contact.created", data: {} }, "x1")).toBe("ignored");
    expect(await ingestResendEvent(admin, fixture("email.delivered", "not-ours"), "x2")).toBe("ignored");
  });

  it("marks an open within 10 seconds of delivery as possibly automatic", async () => {
    const s = sends[1];
    await ingestResendEvent(admin, fixture("email.opened", s.resend_message_id), `auto_${s.id}`);
    const st = await statusOf(s.id);
    expect(st.status).toBe("opened");
    expect(st.possiblyAutomatic).toBe(true);
  });

  it("logs a read from the hosted page once per half hour, and read beats opened", async () => {
    const s = sends[1];
    expect(await recordRead(admin, s.token)).toBe(true);
    expect(await recordRead(admin, s.token)).toBe(true);
    const { rows } = await db.query("select count(*)::int n from events where send_id = $1 and type = 'read'", [s.id]);
    expect(rows[0].n).toBe(1);
    expect((await statusOf(s.id)).status).toBe("read");
    expect(await recordRead(admin, "x".repeat(43))).toBe(false);
  });

  it("suppresses an address on bounce and on complaint", async () => {
    const [, , bounced] = sends;
    await ingestResendEvent(admin, fixture("email.bounced", bounced.resend_message_id), `b_${bounced.id}`);
    const inv = (await db.query("select suppressed, suppressed_reason from investors where id = $1", [bounced.investor_id])).rows[0];
    expect(inv).toEqual({ suppressed: true, suppressed_reason: "bounced" });
    const sup = await db.query("select reason from suppressions where user_id = $1 and email = $2", [f.userId, bounced.investor_email]);
    expect(sup.rows[0].reason).toBe("bounced");
    expect((await statusOf(bounced.id)).status).toBe("bounced");

    const c = sends[0];
    await ingestResendEvent(admin, fixture("email.complained", c.resend_message_id), `c_${c.id}`);
    expect((await statusOf(c.id)).status).toBe("complained");
  });

  it("does not suppress on a transient bounce", async () => {
    const g = await seedFounder(db, "transient");
    const cfg = { appUrl: "https://a.example.com", sendingDomain: "u.example.com", provider: new MockProvider([]), delayMs: 0, sleep: async () => {} };
    await sendTest(admin, cfg, g.updateId);
    await enqueueSends(admin, g.updateId);
    await processQueue(admin, cfg, g.updateId);
    const s = (await db.query("select id, investor_id, resend_message_id from sends where update_id = $1 limit 1", [g.updateId])).rows[0];
    const p = fixture("email.bounced", s.resend_message_id);
    p.data.bounce.type = "Transient";
    await ingestResendEvent(admin, p, `t_${s.id}`);
    expect((await db.query("select suppressed from investors where id = $1", [s.investor_id])).rows[0].suppressed).toBe(false);
  });

  it("opts an investor out for good and skips them next time", async () => {
    const s = sends[1];
    expect(await optOut(admin, s.token)).toBe(true);
    expect(await optOut(admin, s.token)).toBe(true);
    const { rows } = await db.query("select count(*)::int n from events where send_id = $1 and type = 'opted_out'", [s.id]);
    expect(rows[0].n).toBe(1);
    expect((await statusOf(s.id)).status).toBe("opted_out");

    // Next month: all three are now opted out, bounced or complained. Nobody is emailed.
    const next = await db.query("insert into updates (user_id, month, metrics_json) select user_id, '2026-10-01', metrics_json from updates where id = $1 returning id", [f.updateId]);
    const box: MockMessage[] = [];
    const cfg = { appUrl: "https://app.example.com", sendingDomain: "updates.example.com", provider: new MockProvider(box), delayMs: 0, sleep: async () => {} };
    await sendTest(admin, cfg, next.rows[0].id);
    await expect(enqueueSends(admin, next.rows[0].id)).rejects.toThrow("No investors to send to.");
    expect(box.filter((m) => !m.subject.startsWith("[Test]"))).toHaveLength(0);
  });
});
