// Capture README and landing-page screenshots from a running server.
// Usage: node scripts/screenshots.mjs [baseUrl]   (default: http://localhost:3000)
import { chromium, devices } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const browser = await chromium.launch();

async function context(opts, role) {
  const ctx = await browser.newContext(opts);
  if (role) await ctx.request.post(`${BASE}/api/auth/demo`, { data: { role } });
  return ctx;
}

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

async function shot(page, path, file, { prep, fullPage = false, wait = 1200 } = {}) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (prep) await prep(page);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: file, fullPage });
  console.log("saved", file);
}

// public pages
{
  const ctx = await context(desktop);
  const p = await ctx.newPage();
  await shot(p, "/", `${OUT}/landing.png`);
  await shot(p, "/signin", `${OUT}/signin.png`);
  await ctx.close();
}

// officer
{
  const ctx = await context(desktop, "officer");
  const p = await ctx.newPage();
  await shot(p, "/app?reach=giofyros-1", `${OUT}/dashboard.png`, { wait: 3500 });
  await p.screenshot({ path: "public/landing/dashboard.png" });
  await shot(p, "/app", `${OUT}/dashboard-overview.png`, { wait: 3500 });
  await shot(p, "/app?rain=40", `${OUT}/what-if-storm.png`, { wait: 3500 });
  await shot(p, "/app/streams/giofyros-1", `${OUT}/stream-record.png`, {
    prep: (pg) => pg.addStyleTag({ content: "nav[aria-label=App]{position:absolute!important}" }),
  });
  await shot(p, "/app/data", `${OUT}/data-explorer.png`);
  await shot(p, "/standards", `${OUT}/standards.png`);
  await p.goto(BASE + "/app/streams/giofyros-1", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Draft response plan" }).click();
  await p.getByTestId("response-plan").waitFor({ timeout: 180000 });
  await p.getByText(/Evidence \(\d+\)/).click();
  const panel = p.locator("section", { has: p.getByRole("heading", { name: "Response plan" }) });
  await panel.screenshot({ path: `${OUT}/ai-duty-officer.png` });
  console.log("saved ai-duty-officer");
  await ctx.close();
}

// clinician
{
  const ctx = await context(desktop, "clinician");
  const p = await ctx.newPage();
  await shot(p, "/app/clinic", `${OUT}/clinic-cds-hooks.png`, { prep: (pg) => pg.locator("article").first().waitFor() });
  await ctx.close();
}

// citizen
{
  const ctx = await context(desktop, "citizen");
  const p = await ctx.newPage();
  await shot(p, "/app/check?site=giofyros-1", `${OUT}/stream-check.png`, {
    prep: async (pg) => {
      await pg.getByRole("button", { name: /^A lot/ }).click();
      await pg.getByRole("button", { name: /Rushing/ }).click();
      await pg.getByRole("button", { name: /Most of it/ }).click();
    },
  });
  await ctx.close();
  const m = await context({ ...devices["iPhone 14"], deviceScaleFactor: 3 }, "citizen");
  const mp = await m.newPage();
  await shot(mp, "/app?reach=giofyros-1", `${OUT}/mobile-home.png`, { wait: 3500 });
  await shot(mp, "/app/check?site=almyros-1", `${OUT}/mobile-check.png`);
  await m.close();
}

await browser.close();
