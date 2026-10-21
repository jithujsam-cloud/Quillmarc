import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, generateToken, isWellFormedToken, parseKey } from "@/lib/crypto";

const key = randomBytes(32).toString("hex");

describe("encryption", () => {
  it("round-trips and never stores the plaintext", () => {
    const c = encrypt("rk_test_secret", key);
    expect(c).not.toContain("rk_test_secret");
    expect(c.startsWith("v1:")).toBe(true);
    expect(decrypt(c, key)).toBe("rk_test_secret");
  });

  it("uses a fresh IV every time", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });

  it("fails on tampering or the wrong key", () => {
    const c = encrypt("secret", key);
    const parts = c.split(":");
    parts[3] = Buffer.from("xxxxxx").toString("base64");
    expect(() => decrypt(parts.join(":"), key)).toThrow();
    expect(() => decrypt(c, randomBytes(32).toString("hex"))).toThrow();
  });

  it("accepts hex or base64 keys of 32 bytes only", () => {
    expect(parseKey(randomBytes(32).toString("base64")).length).toBe(32);
    expect(() => parseKey("short")).toThrow(/32 bytes/);
  });
});

describe("tokens", () => {
  it("are 43 url-safe characters and unique", () => {
    const set = new Set(Array.from({ length: 2000 }, generateToken));
    expect(set.size).toBe(2000);
    for (const tkn of set) expect(isWellFormedToken(tkn)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(42) + "!")).toBe(false);
  });
});
