import { expect, test } from "@playwright/test";

test.describe("stream record", () => {
  test("hazards explain themselves and link to FHIR", async ({ page, request }) => {
    await page.goto("/app/streams/giofyros-1");
    for (const [tab, h] of [
      ["Algal bloom", "Toxic algal bloom"],
      ["Mosquitoes", "Mosquito-borne disease"],
      ["Pathogens", "Waterborne pathogens"],
    ]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: /Risk factors/ })).toBeVisible();
    await page.getByRole("tab", { name: /Advice/ }).click();
    await expect(page.getByText("For people nearby")).toBeVisible();
    await expect(page.getByText("For clinicians")).toBeVisible();
    await page.getByRole("tab", { name: /Weather/ }).click();
    await expect(page.getByText(/Open-Meteo, live|offline climatology/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Latest activity" }).locator("li").first()).toBeVisible();

    await page.getByRole("tab", { name: /FHIR/ }).click();
    const json = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(json.resourceType).toBe("RiskAssessment");
    expect(json.prediction.length).toBeGreaterThan(0);

    const links = await page.locator("a.fhir-link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
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
