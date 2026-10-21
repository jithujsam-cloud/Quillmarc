// AES-256-GCM for secrets at rest, and random tokens for hosted pages.
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** ENCRYPTION_KEY is 32 bytes, given as 64 hex characters or base64. */
export function parseKey(raw: string): Buffer {
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).");
  return key;
}

/** Returns "v1:<iv>:<tag>:<ciphertext>", all base64. */
export function encrypt(plain: string, rawKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseKey(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(payload: string, rawKey: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unknown ciphertext format.");
  const decipher = createDecipheriv("aes-256-gcm", parseKey(rawKey), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** 32 random bytes, base64url: 43 characters, 256 bits. Not guessable. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
