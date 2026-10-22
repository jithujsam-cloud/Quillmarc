import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./session";

// Runs after the other specs (alphabetical). The seeded founder is also in ADMIN_EMAILS.
test("when the trial ends sending stops, and an admin can turn it back on", async ({ page, context }) => {
  const saved = await signIn(context);
  const admin = createClient(saved.supabaseUrl, saved.serviceKey, { auth: { persistSession: false } });
  // Start from a set-up account whatever ran before: connected to sample data.
  const { data: me } = await admin.from("profiles").select("id").limit(1).single();
  await admin.from("stripe_connections").upsert({ user_id: me!.id, method: "sample", status: "connected" }, { onConflict: "user_id" });

  await page.goto("/settings");
  await expect(page.getByText(/Free trial, \d+ days left/).first()).toBeVisible();

  // The trial runs out.
  await admin.from("profiles").update({ trial_ends_at: new Date(Date.now() - 60_000).toISOString() }).neq("id", "00000000-0000-0000-0000-000000000000");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your free trial has ended" })).toBeVisible();
  await expect(page.getByText("Trial ended").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Quillmarc" }).first()).toHaveAttribute("href", "https://pay.example/quillmarc");
  await page.goto("/updates/new");
  await expect(page.getByRole("button", { name: "Calculate the numbers" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your free trial has ended" })).toBeVisible();

  // The owner extends it from the admin page.
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await page.getByRole("button", { name: "Add 14 days" }).first().click();
  await expect(page.getByText(/Free trial, 14 days left/).first()).toBeVisible();
  await page.getByRole("button", { name: "Activate" }).first().click();
  await expect(page.locator("tbody").getByText("Active", { exact: true }).first()).toBeVisible();

  await page.goto("/updates/new");
  await expect(page.getByRole("button", { name: "Calculate the numbers" })).toBeVisible();
});

test("a signed-out visitor cannot open the admin page", async ({ request }) => {
  const res = await request.get("/admin", { maxRedirects: 0 });
  expect([303, 307, 404]).toContain(res.status());
});
