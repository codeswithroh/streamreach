import { expect, test } from "@playwright/test";

test("every endpoint linked from the standards page responds", async ({ page, request }) => {
  await page.goto("/standards");
  await expect(page.getByRole("heading", { name: "Resource map" })).toBeVisible();
  const discovery = JSON.parse((await page.locator("pre.json").textContent())!);
  expect(discovery.services[0].id).toBe("streamreach-stream-exposure");
  const hrefs = await page.locator('main a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!.split("#")[0]))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(9);
  for (const h of hrefs) {
    const r = await request.get(h);
    expect(r.status(), h).toBe(200);
  }
});
