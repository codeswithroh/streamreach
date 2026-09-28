// Capture README screenshots from a running server (default: local dev).
// Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await desktop.newPage();

async function shot(path, name, prep) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (prep) await prep(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("saved", name);
}

await shot("/", "situation-room");
await shot("/?rain=40", "what-if-storm", async (p) => {
  await p.locator("section:has(h2)").scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollTo(0, 0));
});
await shot("/sites/giofyros-1", "stream-record");
await shot("/check?site=giofyros-1", "stream-check", async (p) => {
  await p.getByRole("button", { name: /^A lot/ }).click();
  await p.getByRole("button", { name: /Rushing/ }).click();
  await p.getByRole("button", { name: /Most of it/ }).click();
  await p.evaluate(() => window.scrollTo(0, 260));
});
await shot("/clinic", "clinic-cds-hooks", async (p) => {
  await p.locator("article").first().waitFor();
});
await shot("/data", "data-explorer");
await shot("/standards", "standards");

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const m = await mobile.newPage();
await m.goto(BASE + "/check?site=almyros-1", { waitUntil: "networkidle" });
await m.screenshot({ path: `${OUT}/mobile-check.png` });
await m.goto(BASE + "/", { waitUntil: "networkidle" });
await m.waitForTimeout(800);
await m.screenshot({ path: `${OUT}/mobile-home.png` });
console.log("saved mobile");
await browser.close();
