import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";
import { isTimeZone, timeZoneOptions } from "@/lib/timezone";

describe("showing times in the founder's time zone", () => {
  const iso = "2026-10-22T22:30:00Z";

  it("stays in UTC until a zone is set", () => {
    expect(formatDate(iso)).toBe("Oct 22, 2026");
    expect(formatDateTime(iso)).toContain("10:30 PM");
  });

  it("moves a late-evening UTC time to the next day in India, and names the zone", () => {
    expect(formatDate(iso, "Asia/Kolkata")).toBe("Oct 23, 2026");
    expect(formatDateTime(iso, "Asia/Kolkata")).toMatch(/Oct 23, 2026, 4:00 AM/);
  });

  it("moves an early UTC time back a day in the US", () => {
    expect(formatDate("2026-10-22T02:00:00Z", "America/Los_Angeles")).toBe("Oct 21, 2026");
  });

  it("accepts real zones and refuses anything else", () => {
    expect(isTimeZone("Asia/Kolkata")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(42)).toBe(false);
    expect(isTimeZone("x".repeat(100))).toBe(false);
  });

  it("lists UTC first", () => {
    expect(timeZoneOptions()[0]).toBe("UTC");
  });
});
