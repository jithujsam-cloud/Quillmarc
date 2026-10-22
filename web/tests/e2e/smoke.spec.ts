import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./session";

// The whole founder flow with sample data and the mock email provider:
// review metrics, edit one, write bullets, preview, send a test, send, see statuses, open the hosted page, opt out.
test("founder sends an update and sees statuses", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await signIn(context);
  // The dashboard shows revenue and monthly numbers from the sample account's payments and subscriptions.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue collected" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Month by month" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue by day" })).toBeVisible();

  await page.goto("/updates");
  await expect(page.getByRole("heading", { name: "Updates", exact: true })).toBeVisible();

  // Add an update for the last finished quarter. The dates it covers are on screen before anything is calculated.
  await page.getByRole("link", { name: "Add update" }).first().click();
  await page.getByLabel("Quarterly").check();
  await expect(page.getByText(/This update will cover/)).toContainText(/\d+ \w+ \d{4} to \d+ \w+ \d{4}/);
  await page.getByRole("button", { name: "Calculate the numbers" }).click();
  await expect(page.getByRole("heading", { name: "Review the numbers" })).toBeVisible();
  await expect(page.getByLabel(/^Covers Q\d \d{4}/).first()).toBeVisible();
  await expect(page.getByText("Last quarter MRR").first()).toBeVisible();
  await expect(page.getByText("Sample data.").first()).toBeVisible();

  // Every figure explains itself. Edit one.
  await page.getByText("How this was calculated").first().click();
  await expect(page.getByText(/Monthly recurring revenue/)).toBeVisible();
  await page.getByRole("button", { name: "Edit Customers" }).click();
  await page.getByLabel("Your figure for Customers").fill("61");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Bullets.
  await expect(page.getByLabel("Wins")).toBeVisible();
  await page.getByLabel("Wins").fill("Closed our largest annual plan\nShipped team billing");
  await page.getByLabel("Problems").fill("Sales cycle is getting longer");
  await page.getByLabel("Asks").fill("Intros to finance leads");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Preview.
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  const email = page.frameLocator('iframe[title="Email preview"]').first();
  await expect(email.getByText("Closed our largest annual plan")).toBeVisible();
  await expect(email.getByText("Adjusted by founder")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Recipients: untick one.
  await expect(page.getByRole("heading", { name: "Send to" })).toBeVisible();
  await page.getByLabel(/Alex Kim/).uncheck();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Send is locked until a test goes out.
  await expect(page.getByRole("heading", { name: "Send a test to yourself" })).toBeVisible();
  const send = page.getByRole("button", { name: "Send to investors" });
  await expect(send).toBeDisabled();
  await page.getByRole("button", { name: "Send test to me" }).click();
  await expect(page.getByText(/Test sent to/)).toBeVisible();
  await expect(send).toBeEnabled();
  await send.click();
  await page.getByRole("button", { name: "Yes, send it" }).click();

  // Status page: five investors, all sent through the mock provider.
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Some email apps open messages automatically")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText(/Sent [A-Z][a-z]{2} \d+, \d{4}/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tbody").getByText("Sent", { exact: true })).toHaveCount(5);

  // Mock webhooks update the statuses.
  await page.getByRole("button", { name: "Simulate events" }).click();
  await expect(page.locator("tbody").getByText("Delivered", { exact: true }).first()).toBeVisible();
  await expect(page.locator("tbody").getByText("Bounced")).toHaveCount(1);
  await expect(page.locator("tbody").getByText("Opened, possibly automatic").first()).toBeVisible();

  // The updates table says how many investors it reached, out of everyone on the list.
  await page.goto("/updates");
  await expect(page.getByText("Investors reached", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText(/\d+ of \d+/);

  // Hosted page logs a read, then the investor opts out.
  await page.goBack();
  await page.getByRole("link", { name: "See the update" }).click();
  await expect(page.getByText("No read is logged")).toBeVisible();
});

test("hosted page logs a read, and the investor can opt out", async ({ page, context, request }) => {
  const saved = await signIn(context);
  const admin = createClient(saved.supabaseUrl, saved.serviceKey, { auth: { persistSession: false } });
  // Pick an investor with no read yet, so the read we expect is the one this test causes.
  const { data: sends } = await admin.from("sends").select("id, token, investor_name, update_id").eq("status", "sent").order("investor_name");
  const { data: reads } = await admin.from("events").select("send_id").eq("type", "read");
  const readIds = new Set((reads ?? []).map((r) => r.send_id));
  const target = sends!.find((s) => !readIds.has(s.id))!;
  const before = { count: 0 };

  // A fresh browser with no session, like an investor.
  const investor = await context.browser()!.newContext();
  const p = await investor.newPage();
  await p.goto(`/u/${target.token}`);
  await expect(p.getByRole("heading", { name: /Investor update/ })).toBeVisible();
  await expect(p.getByText(`Hi ${target.investor_name.split(" ")[0]},`)).toBeVisible();
  await expect.poll(async () => (await admin.from("events").select("id", { count: "exact", head: true }).eq("send_id", target.id).eq("type", "read")).count, { timeout: 10_000 }).toBe((before.count ?? 0) + 1);

  // Opt out with a confirm button.
  await p.getByRole("link", { name: "Stop receiving these updates" }).click();
  await p.getByRole("button", { name: "Stop receiving updates" }).click();
  await expect(p.getByRole("heading", { name: "You are unsubscribed" })).toBeVisible();

  // The founder sees it.
  await page.goto(`/updates/${target.update_id}`);
  await expect(page.getByRole("row", { name: new RegExp(target.investor_name) }).getByText("Opted out")).toBeVisible();

  // Unknown tokens show nothing. The webhook rejects unsigned requests.
  expect((await p.goto("/u/" + "x".repeat(43)))?.status()).toBe(404);
  const bad = await request.post("/api/webhooks/resend", { data: { type: "email.delivered" } });
  expect(bad.status()).toBe(401);
  await investor.close();
});
