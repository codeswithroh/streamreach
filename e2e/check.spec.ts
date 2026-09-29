import { expect, test } from "@playwright/test";
import { AUTH, e2eState, watchErrors } from "./helpers";

test.describe("citizen stream check → record → verification", () => {
  test.use({ storageState: AUTH.citizen });

  test("a citizen submits a check, an officer verifies it", async ({ page, browser }) => {
    const w = watchErrors(page);
    const { citizenCode } = e2eState();
    // two decimals (seed data uses one), so this check can't collide with demo rows
    const temp = `${(10 + Math.random() * 5).toFixed(1)}${1 + Math.floor(Math.random() * 9)}`;
    await page.goto("/app/check?site=alna-oslo");
    await expect(page.locator("select")).toHaveValue("alna-oslo");
    await expect(page.getByText(citizenCode).first()).toBeVisible();

    const submit = page.getByRole("button", { name: "Submit check" });
    await expect(submit).toBeDisabled();
    await page.getByRole("button", { name: /^A lot/ }).click();
    await page.getByRole("button", { name: /Rushing/ }).click();
    await expect(submit).toBeDisabled(); // needs 3 answers
    await page.getByRole("button", { name: /Patches/ }).click();
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: /None seen/ }).click();
    await page.getByPlaceholder("e.g. 21.5").fill(temp);
    await expect(page.getByText("4/4 answered")).toBeVisible();

    await page.getByRole("button", { name: /preview FHIR bundle/ }).click();
    const bundle = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(bundle.type).toBe("transaction");
    expect(bundle.entry).toHaveLength(5);

    await submit.click();
    await expect(page.getByText(`Thank you, ${citizenCode}`)).toBeVisible();
    await expect(page.getByText(/saved as 5 FHIR Observations/)).toBeVisible();

    // on the stream record, awaiting verification, under the citizen's server-assigned code
    await page.getByRole("link", { name: "See the stream record" }).click();
    await expect(page).toHaveURL(/\/app\/streams\/alna-oslo/);
    const row = page.locator("li", { hasText: `Water temp: ${temp} °C` });
    await expect(row).toContainText(citizenCode);
    await expect(row.getByText("awaiting verification")).toBeVisible();

    // an officer verifies it from the queue; the state persists and shows up in FHIR
    const officer = await browser.newContext({ storageState: AUTH.officer });
    const op = await officer.newPage();
    await op.goto("/app/data?tab=queue&site=alna-oslo");
    const qrow = op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode });
    await expect(qrow.getByText("new")).toBeVisible();
    await qrow.getByRole("button", { name: "Verify" }).click();
    await expect(op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode })).toHaveCount(0);
    await op.goto("/app/data?site=alna-oslo");
    await expect(op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode }).getByText("verified")).toBeVisible();
    await op.reload();
    await expect(op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode }).getByText("verified")).toBeVisible();

    const obs = await (await op.request.get("/fhir/Observation?subject=Location/alna-oslo&code=waterTemperature&_count=10")).json();
    const mine = obs.entry.map((e: { resource: Record<string, never> }) => e.resource).find((r: { valueQuantity?: { value: number } }) => r.valueQuantity?.value === Number(temp));
    expect(mine.performer[0].identifier.value).toBe(citizenCode);
    expect(mine.meta.tag[0].code).toBe("citizen-verified");

    await op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode }).getByRole("button", { name: "undo" }).click();
    await expect(op.locator("tr", { hasText: `Water temp: ${temp} °C` }).filter({ hasText: citizenCode }).getByText("awaiting")).toBeVisible();
    await officer.close();
    w.assertClean();
  });

  test("'Check another reach' resets the form", async ({ page }) => {
    await page.goto("/app/check?site=mondego-coimbra");
    await page.getByRole("button", { name: /Nothing unusual/ }).click();
    await page.getByRole("button", { name: /Flowing/ }).click();
    await page.getByRole("button", { name: /Almost none/ }).click();
    await page.getByRole("button", { name: "Submit check" }).click();
    await page.getByRole("button", { name: "Check another reach" }).click();
    await expect(page.getByText("0/4 answered")).toBeVisible();
  });
});
