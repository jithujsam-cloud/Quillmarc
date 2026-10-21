// Renders the share image and PNG icons from brand/tools/og.html.
// Usage: node brand/tools/render_images.js  (needs Playwright with Chromium available)
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "..", "..");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto("file://" + path.join(__dirname, "og.html"));
  await p.waitForTimeout(1500);
  await (await p.$(".og")).screenshot({ path: path.join(root, "assets", "og.png") });
  await (await p.$("#icon")).screenshot({ path: path.join(root, "assets", "apple-touch-icon.png") });
  await (await p.$("#fav")).screenshot({ path: path.join(root, "assets", "favicon-32.png"), omitBackground: true });
  await b.close();
  console.log("wrote assets/og.png, assets/apple-touch-icon.png, assets/favicon-32.png");
})();
