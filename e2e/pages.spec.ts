import { expect, test } from "@playwright/test";
import { PAGES, SITE_IDS, watchErrors } from "./helpers";

test.describe("every page renders without errors", () => {
  for (const path of PAGES) {
    test(`GET ${path}`, async ({ page }) => {
      const w = watchErrors(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      w.assertClean();
    });
  }

  for (const id of SITE_IDS) {
    test(`stream record ${id}`, async ({ page }) => {
      const w = watchErrors(page);
      const res = await page.goto(`/sites/${id}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("article")).toHaveCount(3);
      await expect(page.getByText("Why this score").first()).toBeVisible();
      w.assertClean();
    });
  }

  test("unknown reach returns 404", async ({ page }) => {
    const res = await page.goto("/sites/does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("top navigation reaches every section", async ({ page }) => {
    await page.goto("/");
    for (const [label, path, heading] of [
      ["Stream check", "/check", /What does the stream look like/],
      ["Clinic view", "/clinic", /stream shows up in the consultation/],
      ["Data", "/data", /full record/],
      ["Standards", "/standards", /standards health systems/],
      ["Situation room", "/", /From streams/],
    ] as const) {
      await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
      await expect(page.locator("h1")).toHaveText(heading);
    }
  });
});
