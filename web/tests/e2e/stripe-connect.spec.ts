import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./session";

// Connect with Stripe, end to end, against the fake Stripe in the local stack.
// Runs after the other files (alphabetical), because it swaps the demo account off sample data.
test("founder connects Stripe with one click and gets real numbers", async ({ page, context }) => {
  const saved = await signIn(context);
  const admin = createClient(saved.supabaseUrl, saved.serviceKey, { auth: { persistSession: false } });

  await page.goto("/settings");
  await page.getByText("Connect a different Stripe account").click();
  await page.getByRole("link", { name: "Connect with Stripe" }).click();

  // Back from "Stripe": connected, read only, with the account's name.
  await expect(page).toHaveURL(/\/settings\?stripe=connected/);
  await expect(page.getByText("Stripe is connected with read-only access.")).toBeVisible();
  await expect(page.getByText(/Connected with Stripe Connect to Fake Stripe Co \(test mode\)\. Read only\./)).toBeVisible();

  // Only the account id is stored. No key, no token.
  const { data: row } = await admin.from("stripe_connections").select("*").single();
  expect(row).toMatchObject({ method: "oauth", stripe_account_id: "acct_localfake1", encrypted_key: null, key_mode: "test" });
  expect(JSON.stringify(row)).not.toContain("sk_test_should_be_dropped");

  // Numbers now come from the connected account: three $250 subscriptions, one started this month.
  await page.goto("/updates/new");
  await page.getByRole("radio", { name: /so far/ }).first().check(); // the month in progress
  await page.getByRole("button", { name: "Calculate the numbers" }).click();
  await expect(page.getByRole("heading", { name: "Review the numbers" })).toBeVisible();
  await expect(page.getByText(/From your Stripe subscriptions/)).toBeVisible();
  await expect(page.getByText("$750", { exact: true }).first()).toBeVisible();

  // The dashboard reads the account's payments (three in the fake Stripe: yesterday, 10 and 40 days ago).
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Revenue", exact: true })).toBeVisible();
  await expect(page.getByText("Importing your payment history")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Revenue by day" })).toBeVisible();

  // A stranger's callback with a state that does not match is refused.
  await page.goto("/api/stripe/callback?code=ac_localfake&state=forged");
  await expect(page).toHaveURL(/stripe=expired/);

  // Disconnect revokes and deletes.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Disconnect Stripe" }).click();
  await expect(page.getByText("Stripe is disconnected and the key is deleted.")).toBeVisible();
  const { data: gone } = await admin.from("stripe_connections").select("id");
  expect(gone).toEqual([]);
});
