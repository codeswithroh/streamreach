import { expect, test } from "@playwright/test";
import { AUTH, PAGES, noHorizontalOverflow, watchErrors } from "./helpers";

test.describe("mobile", () => {
  for (const path of [...PAGES, "/app/data?tab=volunteers", "/app?reach=giofyros-1"]) {
    test(`no sideways scroll on ${path}`, async ({ page }) => {
      const w = watchErrors(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noHorizontalOverflow(page);
      w.assertClean();
    });
  }

  test("a citizen check works on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ ...test.info().project.use, storageState: AUTH.citizen });
    const page = await ctx.newPage();
    await page.goto("/app/check?site=giofyros-2");
    await page.getByRole("button", { name: /A little/ }).tap();
    await page.getByRole("button", { name: /Still/ }).tap();
    await page.getByRole("button", { name: /About half/ }).tap();
    await page.getByRole("button", { name: /Yes, wriggling/ }).tap();
    await page.getByRole("button", { name: "Submit check" }).tap();
    await expect(page.getByText(/Your check is now part of/)).toBeVisible();
    await noHorizontalOverflow(page);
    await ctx.close();
  });

  test("app navigation sits at the bottom on phones", async ({ page }) => {
    await page.goto("/app");
    const rail = page.getByRole("navigation", { name: "App" });
    await expect(rail.getByRole("link", { name: "Stream check" })).toBeInViewport();
    await rail.getByRole("link", { name: "Data" }).tap();
    await expect(page).toHaveURL(/\/app\/data/);
  });
});
