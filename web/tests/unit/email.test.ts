import { describe, expect, it } from "vitest";
import { escapeHtml, renderUpdateEmail, subjectFor } from "@/lib/email/render";
import { fromAddress } from "@/lib/sending/queue";
import { figures } from "@/lib/metrics/present";
import { calculateMetrics } from "@/lib/metrics";
import { data, sub, t } from "../fixtures/billing";
import { MockProvider, ResendProvider, EmailSendError } from "@/lib/email/provider";

const metrics = calculateMetrics(data([sub(), sub({ startDate: t("2026-09-10T00:00:00Z") })]), { month: "2026-09", now: t("2026-10-05T00:00:00Z") });
const content = {
  founderName: "Ada <script>",
  companyName: "Northwind & Co",
  periodLabel: "September 2026",
  periodRange: "1 to 30 Sep 2026",
  noun: "month",
  running: false,
  figures: figures(metrics, { customers: 3 }),
  bullets: { wins: ["Closed <b>Acme</b>"], problems: [], asks: ["Intros to \"CFOs\""] },
  sample: false,
};

describe("renderUpdateEmail", () => {
  const out = renderUpdateEmail(content, { greetingName: "Ivy", readUrl: "https://app.example.com/u/abc", unsubscribeUrl: "https://app.example.com/u/abc/stop" });

  it("uses the subject format", () => {
    expect(out.subject).toBe("Northwind & Co investor update, September 2026");
    expect(subjectFor("A", "May 2026")).toBe("A investor update, May 2026");
  });

  it("escapes every piece of user text in HTML", () => {
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<b>Acme</b>");
    expect(out.html).toContain("Closed &lt;b&gt;Acme&lt;/b&gt;");
    expect(out.html).toContain("Northwind &amp; Co");
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });

  it("includes greeting, numbers, groups, button and opt-out in both versions", () => {
    for (const body of [out.html, out.text]) {
      expect(body).toContain("Hi Ivy,");
      expect(body).toContain("https://app.example.com/u/abc");
      expect(body).toContain("https://app.example.com/u/abc/stop");
      expect(body).toContain("$100");
    }
    expect(out.html).toContain("Read the full update");
    expect(out.text).toContain("ASKS");
    expect(out.text).not.toContain("PROBLEMS"); // empty groups are left out
    expect(out.text).toContain("Customers: 3 (adjusted by founder)");
  });

  it("contains no em dashes", () => {
    expect(out.html + out.text).not.toMatch(/—/);
  });

  it("builds a safe From header", () => {
    expect(fromAddress('Ada "Boss"\r\nBcc: x', "updates.example.com")).toBe('"Ada BossBcc: x via Quillmarc" <updates@updates.example.com>');
  });
});

describe("providers", () => {
  const msg = { from: "a@b.co", to: "c@d.co", subject: "s", html: "h", text: "t", idempotencyKey: "send-1" };

  it("mock provider honors idempotency keys", async () => {
    const box: never[] = [];
    const p = new MockProvider(box);
    const a = await p.send(msg);
    const b = await p.send(msg);
    expect(a.id).toBe(b.id);
    expect(box).toHaveLength(1);
  });

  it("resend provider sends one recipient with the idempotency header", async () => {
    let seen: RequestInit | undefined;
    const p = new ResendProvider("re_test", (async (_u: string, init?: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as typeof fetch);
    expect(await p.send(msg)).toEqual({ id: "em_1" });
    expect((seen?.headers as Record<string, string>)["Idempotency-Key"]).toBe("send-1");
    const body = JSON.parse(String(seen?.body));
    expect(body.to).toEqual(["c@d.co"]);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
  });

  it("resend provider marks 429 retryable and 422 not", async () => {
    const make = (status: number) => new ResendProvider("re_test", (async () => new Response("{}", { status })) as unknown as typeof fetch);
    await expect(make(429).send(msg)).rejects.toMatchObject({ retryable: true });
    await expect(make(422).send(msg)).rejects.toBeInstanceOf(EmailSendError);
    await expect(make(422).send(msg)).rejects.toMatchObject({ retryable: false });
  });
});
