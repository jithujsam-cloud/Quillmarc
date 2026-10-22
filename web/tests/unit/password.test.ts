import { describe, expect, it } from "vitest";
import { afterEmailLink, passwordProblem } from "@/lib/validate";

describe("passwords", () => {
  it("asks for 8 to 72 characters and nothing else", () => {
    expect(passwordProblem("")).toBe("Enter a password.");
    expect(passwordProblem(undefined)).toBe("Enter a password.");
    expect(passwordProblem("short")).toBe("Use at least 8 characters.");
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("correct horse battery staple")).toBeNull();
    expect(passwordProblem("a".repeat(72))).toBeNull();
    expect(passwordProblem("a".repeat(73))).toBe("Use 72 characters or fewer.");
  });

  it("counts bytes, because the hash stops at 72 of them", () => {
    expect(passwordProblem("é".repeat(36))).toBeNull(); // 72 bytes
    expect(passwordProblem("é".repeat(37))).toBe("Use 72 characters or fewer.");
  });
});

describe("where an email link goes", () => {
  it("goes to the reset page only when asked, and to the dashboard otherwise", () => {
    expect(afterEmailLink("/reset-password")).toBe("/reset-password");
    expect(afterEmailLink("/dashboard")).toBe("/dashboard");
    expect(afterEmailLink(null)).toBe("/dashboard");
  });

  it("never follows an address from the link", () => {
    expect(afterEmailLink("https://evil.example")).toBe("/dashboard");
    expect(afterEmailLink("//evil.example")).toBe("/dashboard");
    expect(afterEmailLink("/settings/data")).toBe("/dashboard");
  });
});
