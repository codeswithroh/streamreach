import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test.describe("clinic view (demo EHR + CDS Hooks)", () => {
  test("Eleni: warning card, draft order, anonymous share feeds the stream", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/app/clinic");
    await expect(page.getByText("Eleni Markaki").first()).toBeVisible();
    const card = page.locator("article").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Gastrointestinal symptoms/);
    await expect(card).toContainText("Giofyros Reach A");

    // raw CDS Hooks exchange is inspectable
    await page.getByRole("button", { name: "Hook request" }).click();
    const req = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(req.hook).toBe("patient-view");
    expect(req.prefetch.patient.id).toBe("eleni-markaki");
    await page.getByRole("button", { name: "Service response" }).click();
    const res = JSON.parse((await page.locator("pre.json").textContent())!);
    expect(res.cards.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: /CDS cards/ }).click();

    // accept the order suggestion → draft ServiceRequest in the chart
    await card.getByRole("button", { name: /Order stool culture/ }).click();
    await expect(page.getByText("Bacteria identified in Stool by Culture")).toBeVisible();
    await expect(page.getByText("draft", { exact: true })).toBeVisible();

    // share → feedback recorded → clinic signal appears in the data explorer
    await card.getByRole("button", { name: /Share anonymous/ }).click();
    await expect(page.getByRole("status")).toContainText("Anonymous case shared");
    await expect(card.getByRole("button", { name: /✓ Share anonymous/ })).toBeDisabled();

    await page.goto("/app/data?tab=clinic&site=giofyros-1");
    await expect(page.getByText("CDS Hooks feedback (live)").first()).toBeVisible();
    w.assertClean();
  });

  test("every demo patient gets a CDS response, and dismissing sends feedback", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/app/clinic");
    for (const name of ["Marco Esposito", "Nikos Papadakis", "Ingrid Solberg", "Eleni Markaki"]) {
      const resp = page.waitForResponse((r) => r.url().includes("/cds-services/") && r.request().method() === "POST");
      await page.getByRole("button", { name: new RegExp(name) }).click();
      expect((await resp).status()).toBe(200);
      await expect(page.locator(".bg-stone-800")).toContainText(name);
      await expect(page.getByRole("button", { name: /CDS cards \(\d\)/ })).toBeVisible();
      const n = Number((await page.getByRole("button", { name: /CDS cards/ }).textContent())!.match(/\((\d)\)/)![1]);
      expect(n).toBeLessThanOrEqual(2);
      if (n === 0) await expect(page.getByText(/Nothing relevant near this patient/)).toBeVisible();
    }

    // dismiss flow on any card that offers override reasons
    const dismiss = page.getByRole("button", { name: "Dismiss…" }).first();
    if (await dismiss.isVisible()) {
      const fb = page.waitForResponse((r) => r.url().endsWith("/feedback"));
      await dismiss.click();
      await page.getByRole("button", { name: "Patient reports no stream contact" }).click();
      expect((await fb).status()).toBe(200);
      await expect(page.getByText(/Dismissed: Patient reports no stream contact/)).toBeVisible();
    }
    w.assertClean();
  });

  test("card source link opens the stream record", async ({ page, context }) => {
    await page.goto("/app/clinic");
    const link = page.locator("article").first().getByRole("link", { name: /Open stream health record/ });
    const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/app\/streams\/giofyros-1/);
    await expect(popup.locator("article")).toHaveCount(3);
  });

  test("a failing CDS service degrades gracefully and can be retried", async ({ page }) => {
    let fail = true;
    await page.route("**/cds-services/streamreach-stream-exposure", (route) =>
      fail ? route.fulfill({ status: 503, body: "" }) : route.continue(),
    );
    await page.goto("/app/clinic");
    const alert = page.getByRole("alert").filter({ hasText: "CDS service" });
    await expect(alert).toContainText("HTTP 503");
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole("button", { name: /CDS cards \(\d\)/ })).toBeVisible();
  });
});
