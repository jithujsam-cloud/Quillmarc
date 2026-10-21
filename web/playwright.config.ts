import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke test. Runs the built app against the local stack with mock email.
// Needs `npm run build` first. No keys and no network calls to Stripe or Resend.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/local-stack.mjs",
    url: "http://127.0.0.1:3100/login",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
