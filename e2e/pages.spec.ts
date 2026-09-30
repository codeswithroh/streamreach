import { expect, test } from "@playwright/test";
import { PAGES, SITE_IDS, watchErrors } from "./helpers";

test.describe("every page renders without errors", () => {
  for (const path of PAGES) {
    test(`GET ${path}`, async ({ page }) => {
      const w = watchErrors(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      w.assertClean();
    });
  }

  for (const id of SITE_IDS) {
    test(`stream record ${id}`, async ({ page }) => {
      const w = watchErrors(page);
      const res = await page.goto(`/app/streams/${id}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Why this score" })).toBeVisible();
      await expect(page.getByRole("img", { name: /Risk factors/ })).toBeVisible();
      w.assertClean();
    });
  }

  test("unknown reach returns 404", async ({ page }) => {
    const res = await page.goto("/app/streams/does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("old URLs redirect to the new app routes", async ({ page }) => {
    await page.goto("/sites/sabato-bn");
    await expect(page).toHaveURL(/\/app\/streams\/sabato-bn/);
    await page.goto("/data");
    await expect(page).toHaveURL(/\/app\/data/);
  });

  test("the app rail reaches every section", async ({ page }) => {
    await page.goto("/app");
    const rail = page.getByRole("navigation", { name: "App" });
    for (const [label, path, heading] of [
      ["Stream check", "/app/check", /What does the stream look like/],
      ["Clinic view", "/app/clinic", /Clinic view/],
      ["Data", "/app/data", /full record/],
      ["Stream records", "/app/streams/giofyros-1", /Giofyros Reach A/],
      ["Monitoring", "/app", /Monitoring/],
    ] as const) {
      await rail.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("h1").first()).toHaveText(heading);
    }
  });
});
