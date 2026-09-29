import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test.describe("monitoring dashboard", () => {
  test("map, stream list, legend, chart and checks", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(10);
    const list = page.getByRole("region", { name: "Streams" });
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await expect(page.getByText("Risk distribution model")).toBeVisible();
    await expect(page.getByRole("img", { name: /Risk probability by hazard/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Stream checks" })).toBeVisible();
    w.assertClean();
  });

  test("search, select a stream, see details and go back", async ({ page }) => {
    await page.goto("/app");
    const list = page.getByRole("region", { name: "Streams" });
    await list.getByPlaceholder("Search streams and cities").fill("oslo");
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await list.getByRole("button", { name: /Akerselva at Nydalen/ }).click();
    await expect(page).toHaveURL(/reach=akerselva-oslo/);
    const detail = page.getByRole("region", { name: "Stream details" });
    await expect(detail.getByText("Akerselva at Nydalen")).toBeVisible();
    await expect(detail.getByText("Waterborne pathogens")).toBeVisible();
    await expect(detail.getByText("Current weather")).toBeVisible();
    await expect(detail.getByRole("link", { name: /Draft response plan with AI/ })).toBeVisible();
    await detail.getByRole("button", { name: "Stream" }).click();
    await expect(page.getByRole("region", { name: "Streams" })).toBeVisible();
  });

  test("clicking a map marker selects that stream", async ({ page }) => {
    await page.goto("/app");
    await page.locator("path.marker-akerselva-oslo").click({ force: true });
    await expect(page).toHaveURL(/reach=/);
    await expect(page.getByRole("region", { name: "Stream details" })).toBeVisible();
  });

  test("date strip, hazard and weather selectors, CSV export", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/app?reach=giofyros-1");
    const today = page.getByRole("button", { name: /^Today/ });
    await expect(today).toHaveAttribute("aria-pressed", "true");
    const strip = page.locator("button[aria-pressed]").filter({ hasText: /Oct|Sep|Today/ });
    const next = strip.nth((await strip.count()) - 1);
    await next.click();
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(today).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", { name: "Stream details" }).getByText(/Hazards · \d+ \w+/)).toBeVisible();

    await page.locator("select").filter({ hasText: "Pathogens" }).selectOption("waterborne");
    await expect(page.getByRole("img", { name: /Risk probability by hazard/ }).locator("path")).toHaveCount(1);
    await page.locator("select").filter({ hasText: "Temperature" }).selectOption("temp");
    await expect(page.getByText("Max temperature, °C")).toBeVisible();

    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download chart data/ }).click()]);
    expect(dl.suggestedFilename()).toBe("giofyros-1-risk.csv");
    w.assertClean();
  });

  test("what-if scenario recomputes and carries into stream records", async ({ page }) => {
    await page.goto("/app");
    await page.getByLabel("What-if scenario").selectOption("storm");
    await expect(page).toHaveURL(/rain=40/);
    await expect(page.getByText(/What-if: Storm tomorrow/)).toBeVisible();
    await page.goto("/app/streams/giofyros-1?rain=40");
    await expect(page.getByText("What-if scenario active")).toBeVisible();
    await page.getByRole("link", { name: "Back to the real forecast" }).click();
    await expect(page.getByText("What-if scenario active")).toHaveCount(0);
  });

  test("add stream check from the dashboard", async ({ page }) => {
    await page.goto("/app?reach=sabato-bn");
    await page.getByRole("link", { name: /Add new stream check/ }).click();
    await expect(page).toHaveURL(/\/app\/check\?site=sabato-bn/);
  });
});
