import { describe, expect, it } from "vitest";
import { firstName, parseInvestorList } from "@/lib/investors";
import { isEmail, isNoReplyAddress } from "@/lib/validate";

describe("parseInvestorList", () => {
  it("reads name, email lines in several shapes", () => {
    const r = parseInvestorList(["Ada Lovelace, ada@example.com", "Grace Hopper <Grace@Example.com>", "ivy@example.com, Ivy Chen", "Tab Person\ttab@example.com"].join("\n"));
    expect(r.investors).toEqual([
      { name: "Ada Lovelace", email: "ada@example.com" },
      { name: "Grace Hopper", email: "grace@example.com" },
      { name: "Ivy Chen", email: "ivy@example.com" },
      { name: "Tab Person", email: "tab@example.com" },
    ]);
    expect(r.errors).toEqual([]);
  });

  it("reads a CSV with a header row and quoted fields", () => {
    const r = parseInvestorList('Email,Name,Firm\nada@example.com,"Lovelace, Ada",Analytical\n');
    expect(r.investors).toEqual([{ name: "Lovelace, Ada", email: "ada@example.com" }]);
  });

  it("removes duplicates, including ones already stored", () => {
    const r = parseInvestorList("A, a@example.com\nA again, A@example.com\nB, b@example.com", ["b@example.com"]);
    expect(r.investors).toHaveLength(1);
    expect(r.duplicates).toBe(2);
  });

  it("reports invalid lines with their line number", () => {
    const r = parseInvestorList("Ada, ada@example\n\nno-name@example.com");
    expect(r.errors.map((e) => [e.line, e.reason])).toEqual([
      [1, "No valid email address"],
      [3, "Add a name before the email"],
    ]);
  });

  it("gets a first name for the greeting", () => {
    expect(firstName("  Ada Lovelace ")).toBe("Ada");
  });
});

describe("email checks", () => {
  it("validates addresses", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a..b@c.co")).toBe(false);
    expect(isEmail("a b@c.co")).toBe(false);
  });

  it("spots addresses that are not an inbox", () => {
    expect(isNoReplyAddress("noreply@acme.com")).toBe(true);
    expect(isNoReplyAddress("no-reply+x@acme.com")).toBe(true);
    expect(isNoReplyAddress("ada@acme.com")).toBe(false);
  });
});
