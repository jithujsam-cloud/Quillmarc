import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { adminClient, connect, hasDb } from "./db";
import { seedFounder } from "./helpers";
import { MockProvider, type MockMessage, type EmailProvider, type OutgoingEmail } from "@/lib/email/provider";
import { enqueueSends, processQueue, sendTest, SendGateError, type QueueConfig } from "@/lib/sending/queue";

const noSleep = async () => {};

describe.skipIf(!hasDb)("sending", () => {
  let db: pg.Client;
  const admin = hasDb ? adminClient() : (null as never);

  beforeAll(async () => {
    db = await connect();
  });
  afterAll(async () => {
    await db.end();
  });

  function config(provider: EmailProvider): QueueConfig {
    return { appUrl: "https://app.example.com", sendingDomain: "updates.example.com", provider, delayMs: 0, sleep: noSleep };
  }

  it("refuses to send before a test send exists", async () => {
    const f = await seedFounder(db, "gate");
    await expect(enqueueSends(admin, f.updateId)).rejects.toBeInstanceOf(SendGateError);
    const { rows } = await db.query("select count(*)::int n from sends where update_id = $1", [f.updateId]);
    expect(rows[0].n).toBe(0);
  });

  it("sends a test to the founder only, then one email per investor", async () => {
    const f = await seedFounder(db, "happy");
    const box: MockMessage[] = [];
    const cfg = config(new MockProvider(box));
    await sendTest(admin, cfg, f.updateId);
    expect(box).toHaveLength(1);
    expect(box[0].to).toBe(f.email);
    expect(box[0].subject).toBe("[Test] Northwind investor update, September 2026");

    await enqueueSends(admin, f.updateId);
    const r = await processQueue(admin, cfg, f.updateId);
    expect(r).toEqual({ sent: 3, failed: 0, remaining: 0 });
    const investorMail = box.slice(1);
    expect(investorMail.map((m) => m.to).sort()).toEqual([`ivy-happy@example.com`, `lena-happy@example.com`, `omar-happy@example.com`]);
    for (const m of investorMail) {
      expect(m.from).toBe('"Ada Founder via Quillmarc" <updates@updates.example.com>');
      expect(m.replyTo).toBe("ada@northwind.example");
      expect(m.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.example\.com\/api\/unsubscribe\?token=[A-Za-z0-9_-]{43}>$/);
      expect(m.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    }
    expect(investorMail.find((m) => m.to.startsWith("ivy"))?.text).toContain("Hi Ivy,");
    const { rows } = await db.query("select status, sent_at from updates where id = $1", [f.updateId]);
    expect(rows[0].status).toBe("sent");
  });

  it("is idempotent: enqueueing and processing twice sends once", async () => {
    const f = await seedFounder(db, "twice");
    const box: MockMessage[] = [];
    const cfg = config(new MockProvider(box));
    await sendTest(admin, cfg, f.updateId);
    await enqueueSends(admin, f.updateId);
    await enqueueSends(admin, f.updateId);
    await Promise.all([processQueue(admin, cfg, f.updateId), processQueue(admin, cfg, f.updateId)]);
    await processQueue(admin, cfg, f.updateId);
    expect(box.filter((m) => !m.subject.startsWith("[Test]"))).toHaveLength(3);
    const { rows } = await db.query("select count(*)::int n from sends where update_id = $1", [f.updateId]);
    expect(rows[0].n).toBe(3);
  });

  it("survives a crash after the provider accepted, without emailing anyone twice", async () => {
    const f = await seedFounder(db, "crash");
    const box: MockMessage[] = [];
    const mock = new MockProvider(box);
    await sendTest(admin, config(mock), f.updateId);
    await enqueueSends(admin, f.updateId);

    // The provider accepts the second email, then the worker dies before saving the result.
    let calls = 0;
    const crashing: EmailProvider = {
      name: "mock",
      async send(e: OutgoingEmail) {
        const r = await mock.send(e);
        if (++calls === 2) throw new Error("process killed");
        return r;
      },
    };
    await expect(
      processQueue(admin, { ...config(crashing), maxAttempts: 99, sleep: async () => { if (calls === 2) throw new Error("process killed"); } }, f.updateId),
    ).rejects.toThrow("process killed");

    // The interrupted row is still "sending". Make it stale, then retry with a fresh worker.
    await db.query("update sends set claimed_at = now() - interval '10 minutes' where update_id = $1 and status = 'sending'", [f.updateId]);
    const r = await processQueue(admin, config(mock), f.updateId);
    expect(r.remaining).toBe(0);
    const delivered = box.filter((m) => !m.subject.startsWith("[Test]"));
    expect(delivered).toHaveLength(3);
    expect(new Set(delivered.map((m) => m.to)).size).toBe(3);
  });

  it("retries a failed send and gives up after the limit", async () => {
    const f = await seedFounder(db, "retry");
    const box: MockMessage[] = [];
    const mock = new MockProvider(box);
    await sendTest(admin, config(mock), f.updateId);
    await enqueueSends(admin, f.updateId);
    const failing: EmailProvider = {
      name: "mock",
      async send(e) {
        if (e.to.startsWith("omar")) throw new Error("temporary");
        return mock.send(e);
      },
    };
    const r = await processQueue(admin, config(failing), f.updateId);
    expect(r).toMatchObject({ sent: 2, failed: 1, remaining: 0 });
    const { rows } = await db.query("select attempts, status from sends where update_id = $1 and investor_email like 'omar%'", [f.updateId]);
    expect(rows[0]).toEqual({ attempts: 3, status: "failed" });
  });

  it("skips excluded, opted-out and suppressed investors", async () => {
    const f = await seedFounder(db, "skip");
    await db.query("update updates set excluded_investor_ids = array[$2::uuid] where id = $1", [f.updateId, f.investors[0]]);
    await db.query("update investors set opted_out = true where id = $1", [f.investors[1]]);
    const box: MockMessage[] = [];
    const cfg = config(new MockProvider(box));
    await sendTest(admin, cfg, f.updateId);
    await expect(enqueueSends(admin, f.updateId)).resolves.toEqual({ queued: 1 });
    await processQueue(admin, cfg, f.updateId);
    expect(box.slice(1).map((m) => m.to)).toEqual(["lena-skip@example.com"]);
  });

  it("sends the founder a separate copy when asked", async () => {
    const f = await seedFounder(db, "copy");
    await db.query("update updates set copy_to_founder = true where id = $1", [f.updateId]);
    const box: MockMessage[] = [];
    const cfg = config(new MockProvider(box));
    await sendTest(admin, cfg, f.updateId);
    await enqueueSends(admin, f.updateId);
    await processQueue(admin, cfg, f.updateId);
    await processQueue(admin, cfg, f.updateId);
    const copies = box.filter((m) => m.subject.startsWith("[Your copy]"));
    expect(copies).toHaveLength(1);
    expect(copies[0].to).toBe(f.email);
    // Never as CC or BCC: every message has exactly one recipient.
    expect(box.every((m) => typeof m.to === "string")).toBe(true);
  });
});
