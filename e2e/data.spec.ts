import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test.describe("data explorer", () => {
  test("tabs, counts, filter and pagination", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/app/data");
    await expect(page.getByText(/observations and \d+ clinic signals across 10 reaches/)).toBeVisible();

    for (const tab of ["Citizen checks", "Verification queue", "Lab results", "Clinic signals", "Volunteers"]) {
      await page.getByRole("link", { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole("link", { name: new RegExp(`^${tab}`) })).toHaveClass(/bg-ink/);
      const rows = page.locator("tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    }

    // lab results are graded against the EU thresholds
    await page.getByRole("link", { name: /^Lab results/ }).click();
    await expect(page.locator("tbody .chip").first()).toBeVisible();

    // site filter
    await page.getByRole("link", { name: /^Citizen checks/ }).click();
    await page.getByLabel("Filter by reach").selectOption("akerselva-oslo");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/site=akerselva-oslo/);
    const reaches = await page.locator("tbody tr td:nth-child(2) a").allTextContents();
    expect(new Set(reaches)).toEqual(new Set(["Akerselva at Nydalen"]));

    // pagination
    await page.goto("/app/data");
    const before = await page.locator("tbody tr").count();
    await page.getByRole("link", { name: /Show more/ }).click();
    await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(before);
    w.assertClean();
  });

  test("links in tables lead to stream records", async ({ page }) => {
    await page.goto("/app/data?tab=lab");
    await page.locator("tbody a").first().click();
    await expect(page).toHaveURL(/\/app\/streams\//);
  });
});
