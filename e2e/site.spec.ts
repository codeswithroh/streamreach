import { expect, test } from "@playwright/test";

test.describe("stream record", () => {
  test("hazards explain themselves and link to FHIR", async ({ page, request }) => {
    await page.goto("/app/streams/giofyros-1");
    for (const h of ["Waterborne pathogens", "Toxic algal bloom", "Mosquito-borne disease"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText("For people nearby").first()).toBeVisible();
    await expect(page.getByText("For clinicians").first()).toBeVisible();
    await expect(page.getByText(/Weather ·/)).toBeVisible();
    await expect(page.getByText("Citizen & lab record")).toBeVisible();

    await page.getByText("show JSON").click();
    const json = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(json.resourceType).toBe("RiskAssessment");
    expect(json.prediction.length).toBeGreaterThan(0);

    const links = await page.locator('details a[href^="/fhir/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(links.length).toBe(4);
    for (const l of links) {
      const r = await request.get(l);
      expect(r.status(), l).toBe(200);
      expect((await r.json()).resourceType).toBeTruthy();
    }
  });

  test("'Add a stream check' preselects the reach", async ({ page }) => {
    await page.goto("/app/streams/sabato-bn");
    await page.getByRole("link", { name: /Add a stream check/ }).click();
    await expect(page).toHaveURL(/\/app\/check\?site=sabato-bn/);
    await expect(page.locator("select")).toHaveValue("sabato-bn");
  });
});
