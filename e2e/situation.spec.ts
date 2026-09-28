import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test.describe("situation room", () => {
  test("KPIs, map markers, alerts and reach cards", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/");
    await expect(page.getByText("reaches", { exact: true })).toBeVisible();
    await expect(page.locator("dl dd").first()).toHaveText("10");
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(10);
    await expect(page.getByText("Alerts · next 72 h")).toBeVisible();
    // one card per reach, each with three hazard sparklines
    const cards = page.locator('section:has(h2) a[href^="/sites/"]');
    await expect(cards).toHaveCount(10);
    w.assertClean();
  });

  test("map region filter and marker click open a stream record", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Oslo", exact: true }).click();
    await page.waitForTimeout(1200); // flyTo animation
    await page.locator("path.marker-akerselva-oslo").click();
    await expect(page).toHaveURL(/\/sites\/akerselva-oslo/);
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("what-if presets and sliders recompute and carry into stream records", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/");
    const before = await page.locator("dl dd").nth(1).textContent();

    await page.getByRole("button", { name: /Storm tomorrow/ }).click();
    await expect(page).toHaveURL(/rain=40/);
    await expect(page.getByRole("button", { name: /Storm tomorrow/ })).toHaveClass(/bg-ink/);
    const storm = Number(await page.locator("dl dd").nth(1).textContent());
    expect(storm).toBeGreaterThanOrEqual(Number(before));

    await page.getByRole("button", { name: /Heatwave/ }).click();
    await expect(page).toHaveURL(/heat=6/);

    // slider via keyboard
    const rain = page.getByRole("slider").first();
    await rain.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/rain=5/);

    // scenario travels to the stream record and can be cleared there
    await page.locator('section:has(h2) a[href^="/sites/giofyros-1"]').click();
    await expect(page.getByText("What-if scenario active")).toBeVisible();
    await page.getByRole("link", { name: "Back to the real forecast" }).click();
    await expect(page.getByText("What-if scenario active")).toHaveCount(0);

    await page.goto("/");
    await page.getByRole("button", { name: "Today's forecast" }).click();
    await expect(page).toHaveURL(/\/$/);
    w.assertClean();
  });

  test("alert links open the right stream record", async ({ page }) => {
    await page.goto("/?rain=60");
    const first = page.locator('ul a[href^="/sites/"]').first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(href!.split("?")[0]));
  });
});
