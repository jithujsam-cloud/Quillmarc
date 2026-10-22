import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./session";

// Email and password: create an account, sign out and back in, change the password, ask for a reset.
// Runs last (alphabetical) because it adds a user; it removes that user when it is done.
test("sign up, sign in, change password, forgot password", async ({ browser }) => {
  const saved = await signIn(await browser.newContext()); // only to read the stack's addresses and keys
  const admin = createClient(saved.supabaseUrl, saved.serviceKey, { auth: { persistSession: false } });
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `new-${Date.now()}@example.com`;
  const password = "correct horse battery";

  try {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to Quillmarc" })).toBeVisible();

    // Signing in with nothing, or with an account that does not exist, says so plainly.
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill("whatever it is");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password do not match.")).toBeVisible();

    // Create the account. A short password is refused first.
    await page.getByLabel("Create account").check();
    await expect(page.getByLabel("Work email")).toHaveValue(email); // kept when switching
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Start your free trial" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByLabel("Work email")).toHaveValue(email); // and after an error
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Start your free trial" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Set up Quillmarc" })).toBeVisible();

    // Signed out, the same email cannot be registered twice, and the right password signs in.
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Create account").check();
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Start your free trial" }).click();
    await expect(page.getByText("There is already an account with this email.")).toBeVisible();
    await page.getByLabel("Sign in", { exact: true }).check();
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password do not match.")).toBeVisible();
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Change the password in Settings. The old one stops working.
    const next = "a brand new password";
    await page.goto("/settings");
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("New password again").fill("something else");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("The two passwords are not the same.")).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("New password again").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed.")).toBeVisible();
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password do not match.")).toBeVisible();
    await page.getByLabel("Password").fill(next);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Forgot password gives the same answer for any address, and the reset page needs a signed-in link.
    await context.clearCookies();
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Work email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Email me a reset link" }).click();
    await expect(page.getByText(/If there is an account for/)).toBeVisible();
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (data) await admin.auth.admin.deleteUser(data.id);
  }
});
