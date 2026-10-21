import { describe, expect, it } from "vitest";
import { adminClient, hasDb } from "./db";

describe.skipIf(!hasDb)("local stack", () => {
  it("serves the schema through PostgREST with the service role", async () => {
    const { error, count } = await adminClient().from("profiles").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(typeof count).toBe("number");
  });
});
