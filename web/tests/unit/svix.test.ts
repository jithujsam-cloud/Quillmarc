import { describe, expect, it } from "vitest";
import { signSvix, verifySvix } from "@/lib/webhooks/svix";

const secret = "whsec_" + Buffer.from("a-test-secret-of-some-length!!").toString("base64");
const body = '{"type":"email.delivered"}';
const now = 1790000000;

describe("verifySvix", () => {
  it("accepts a valid signature", () => {
    const sig = signSvix(secret, "msg_1", now, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now)).toBe(true);
  });

  it("accepts any one of several signatures", () => {
    const sig = signSvix(secret, "msg_1", now, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: `v1,bm9wZQ== ${sig}` }, body, now)).toBe(true);
  });

  it("rejects a changed body, id or secret", () => {
    const sig = signSvix(secret, "msg_1", now, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body + " ", now)).toBe(false);
    expect(verifySvix(secret, { id: "msg_2", timestamp: String(now), signature: sig }, body, now)).toBe(false);
    expect(verifySvix("whsec_" + Buffer.from("other").toString("base64"), { id: "msg_1", timestamp: String(now), signature: sig }, body, now)).toBe(false);
  });

  it("rejects old or future timestamps and missing headers", () => {
    const sig = signSvix(secret, "msg_1", now, body);
    expect(verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now + 301)).toBe(false);
    expect(verifySvix(secret, { id: "msg_1", timestamp: null, signature: sig }, body, now)).toBe(false);
    expect(verifySvix("", { id: "msg_1", timestamp: String(now), signature: sig }, body, now)).toBe(false);
  });
});
