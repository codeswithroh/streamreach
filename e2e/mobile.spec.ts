import { expect, test } from "@playwright/test";
import { PAGES, noHorizontalOverflow, uniqueVolunteer, watchErrors } from "./helpers";

test.describe("mobile", () => {
  for (const path of [...PAGES, "/data?tab=volunteers"]) {
    test(`no sideways scroll on ${path}`, async ({ page }) => {
      const w = watchErrors(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noHorizontalOverflow(page);
      w.assertClean();
    });
  }

  test("a citizen check works on a phone", async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem("streamreach-volunteer", v), uniqueVolunteer());
    await page.goto("/check?site=giofyros-2");
    await page.getByRole("button", { name: /A little/ }).tap();
    await page.getByRole("button", { name: /Still/ }).tap();
    await page.getByRole("button", { name: /About half/ }).tap();
    await page.getByRole("button", { name: /Yes, wriggling/ }).tap();
    await page.getByRole("button", { name: "Submit check" }).tap();
    await expect(page.getByText(/Your check is now part of/)).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("map region picker fits on screen", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Coimbra", exact: true });
    await expect(btn).toBeInViewport();
  });
});
