import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./session";

// Accessibility and layout pass: every page, light and dark, at phone, tablet and desktop widths.
// axe checks contrast (4.5:1 text, 3:1 large text), labels, landmarks and roles. We also check that
// no page scrolls sideways. Set QA_SHOTS=dir to save screenshots for a manual look.
const WIDTHS = [360, 390, 768, 1280];

async function check(page: Page, name: string) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Colours ease for 200ms when the theme changes; measure the settled screen.
    await page.waitForTimeout(400);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      if (process.env.QA_SHOTS) await page.screenshot({ path: `${process.env.QA_SHOTS}/${name}-${scheme}-${width}.png`, fullPage: true });
      const overflow = await page.evaluate(() => {
        const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5);
        return { px: document.documentElement.scrollWidth - document.documentElement.clientWidth, culprits: wide.slice(-3).map((el) => el.tagName + "." + el.className) };
      });
      expect(overflow.px, `${name} scrolls sideways at ${width}px: ${overflow.culprits.join(" | ")}`).toBeLessThanOrEqual(0);
    }
    const results = await new AxeBuilder({ page }).exclude("iframe").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
    expect(summary, `${name} (${scheme})`).toEqual([]);
  }
}

test("every page passes axe and fits small screens", async ({ page, context }) => {
  test.setTimeout(600_000);
  await check(await gotoAnd(page, "/login"), "login");
  await check(await gotoAnd(page, "/privacy"), "privacy");
  await check(await gotoAnd(page, "/terms"), "terms");

  const saved = await signIn(context);
  const admin = createClient(saved.supabaseUrl, saved.serviceKey, { auth: { persistSession: false } });
  const { data: sent } = await admin.from("updates").select("*").eq("status", "sent").limit(1).single();
  const { data: draft } = await admin
    .from("updates")
    .upsert({ user_id: sent.user_id, month: "2026-01-01", period_type: "month", period_start: "2026-01-01", period_end: "2026-01-31", metrics_json: sent.metrics_json, bullets_json: sent.bullets_json }, { onConflict: "user_id,period_type,period_start,period_end" })
    .select("id")
    .single();
  const { data: send } = await admin.from("sends").select("token").eq("update_id", sent.id).limit(1).single();
  const { data: anInvestor } = await admin.from("investors").select("id").limit(1).single();
  const investorId = anInvestor!.id;

  const pages: [string, string][] = [
    ["dashboard", "/dashboard"],
    ["updates", "/updates"],
    ["investors", "/investors"],
    ["investor", `/investors/${investorId}`],
    ["asks", "/asks"],
    ["settings", "/settings"],
    ["settings-stripe", "/settings/stripe"],
    ["settings-plan", "/settings/plan"],
    ["settings-data", "/settings/data"],
    ["admin", "/admin"],
    ["onboarding", "/onboarding?step=1"],
    ["new-update", "/updates/new"],
    ["edit-metrics", `/updates/${draft!.id}/edit?step=metrics`],
    ["edit-bullets", `/updates/${draft!.id}/edit?step=bullets`],
    ["edit-preview", `/updates/${draft!.id}/edit?step=preview`],
    ["edit-recipients", `/updates/${draft!.id}/edit?step=recipients`],
    ["edit-send", `/updates/${draft!.id}/edit?step=send`],
    ["status", `/updates/${sent.id}`],
    ["preview", `/updates/${sent.id}/preview`],
    ["hosted", `/u/${send!.token}`],
    ["stop", `/u/${send!.token}/stop`],
  ];
  for (const [name, path] of pages) await check(await gotoAnd(page, path), name);
});

async function gotoAnd(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), path).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  return page;
}
