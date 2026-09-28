import { expect, test } from "@playwright/test";
import { uniqueVolunteer, watchErrors } from "./helpers";

test.describe("citizen stream check → record → verification", () => {
  test("submit a check, see its effect, find it in the record, verify it", async ({ page }) => {
    const w = watchErrors(page);
    const vol = uniqueVolunteer();
    await page.addInitScript((v) => localStorage.setItem("streamreach-volunteer", v), vol);
    await page.goto("/check?site=alna-oslo");
    await expect(page.locator("select")).toHaveValue("alna-oslo");

    const submit = page.getByRole("button", { name: "Submit check" });
    await expect(submit).toBeDisabled();
    await page.getByRole("button", { name: /^A lot/ }).click();
    await page.getByRole("button", { name: /Rushing/ }).click();
    await expect(submit).toBeDisabled(); // needs 3 answers
    await page.getByRole("button", { name: /Patches/ }).click();
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: /None seen/ }).click();
    await page.getByPlaceholder("e.g. 21.5").fill("14.5");
    await expect(page.getByText("4/4 answered")).toBeVisible();

    // FHIR preview is a valid transaction bundle with 5 OAH observations
    await page.getByRole("button", { name: /preview FHIR bundle/ }).click();
    const bundle = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(bundle.type).toBe("transaction");
    expect(bundle.entry).toHaveLength(5);

    await submit.click();
    await expect(page.getByText(`Thank you, ${vol}`)).toBeVisible();
    await expect(page.getByText(/saved as 5 FHIR Observations/)).toBeVisible();
    await expect(page.locator("li", { hasText: "Waterborne pathogens" })).toBeVisible();

    // appears on the stream record as awaiting verification
    await page.getByRole("link", { name: "See the stream record" }).click();
    await expect(page).toHaveURL(/\/sites\/alna-oslo/);
    const row = page.locator("li", { hasText: vol });
    await expect(row).toBeVisible();
    await expect(row.getByText("awaiting verification")).toBeVisible();
    await expect(row.getByText("Water temp: 14.5 °C")).toBeVisible();

    // appears in the verification queue; coordinator verifies it; state persists across reload
    await page.goto("/data?tab=queue&site=alna-oslo");
    const qrow = page.locator("tr", { hasText: vol });
    await expect(qrow.getByText("new")).toBeVisible();
    await qrow.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("tr", { hasText: vol })).toHaveCount(0); // left the queue
    await page.goto("/data?site=alna-oslo");
    const done = page.locator("tr", { hasText: vol });
    await expect(done.getByText("verified")).toBeVisible();
    await page.reload();
    await expect(page.locator("tr", { hasText: vol }).getByText("verified")).toBeVisible();

    // FHIR reflects the verification tag
    const obs = await (await page.request.get("/fhir/Observation?subject=Location/alna-oslo&code=waterTemperature&_count=5")).json();
    const mine = obs.entry.map((e: { resource: { performer: { identifier?: { value: string } }[]; meta: { tag: { code: string }[] } } }) => e.resource).find(
      (r: { performer: { identifier?: { value: string } }[] }) => r.performer[0].identifier?.value === vol,
    );
    expect(mine.meta.tag[0].code).toBe("citizen-verified");

    // undo puts it back in the queue
    await page.locator("tr", { hasText: vol }).getByRole("button", { name: "undo" }).click();
    await expect(page.locator("tr", { hasText: vol }).getByText("awaiting")).toBeVisible();
    w.assertClean();
  });

  test("'Check another reach' resets the form", async ({ page }) => {
    await page.addInitScript((v) => localStorage.setItem("streamreach-volunteer", v), uniqueVolunteer());
    await page.goto("/check?site=mondego-coimbra");
    await page.getByRole("button", { name: /Nothing unusual/ }).click();
    await page.getByRole("button", { name: /Flowing/ }).click();
    await page.getByRole("button", { name: /Almost none/ }).click();
    await page.getByRole("button", { name: "Submit check" }).click();
    await page.getByRole("button", { name: "Check another reach" }).click();
    await expect(page.getByText("0/4 answered")).toBeVisible();
  });
});
