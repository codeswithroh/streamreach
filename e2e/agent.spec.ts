import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

// Locally the server runs with STREAMREACH_AGENT_MOCK=1 (deterministic, no model call).
// Against production (E2E_BASE_URL) the real model runs; set E2E_LIVE_AGENT=1 to allow that.
const remote = !!process.env.E2E_BASE_URL;
test.skip(remote && !process.env.E2E_LIVE_AGENT, "live agent run not requested");

test.describe("AI duty officer", () => {
  test.setTimeout(remote ? 240_000 : 60_000);

  test("drafts a grounded plan, a human approves it, it is published as FHIR", async ({ page, request }) => {
    const w = watchErrors(page);
    await page.goto("/sites/coselhas-coimbra");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Response plan" }) });
    await panel.getByRole("button", { name: /Draft (response|a new) plan/ }).first().click();

    // live trace: the agent reads the risk model first and ends by drafting the plan
    await expect(panel.getByText("Reading the risk model")).toBeVisible({ timeout: remote ? 180_000 : 30_000 });
    const plan = panel.getByTestId("response-plan");
    await expect(plan).toBeVisible({ timeout: remote ? 200_000 : 30_000 });
    await expect(panel.getByText("Drafting the response plan")).toBeVisible();

    // content: priority, advisory in Portuguese + English, GP note, owned actions, evidence
    await expect(plan.getByRole("button", { name: "Portuguese" })).toBeVisible();
    await plan.getByRole("button", { name: "English" }).click();
    await expect(plan.getByText("Note for local GPs")).toBeVisible();
    expect(await plan.locator("ul").first().locator("li").count()).toBeGreaterThan(0);
    await plan.getByText(/Evidence \(\d+\)/).click();
    const axe = await new AxeBuilder({ page }).include("[data-testid=response-plan]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    // human in the loop: nothing is public before approval
    const before = await (await request.get("/fhir/Communication?about=Location/coselhas-coimbra")).json();
    await plan.getByPlaceholder("Duty officer").fill("E2E Officer");
    await plan.getByRole("button", { name: "Approve & publish" }).click();
    await expect(plan.getByRole("status")).toContainText("Published as");
    const link = await plan.getByRole("link", { name: /FHIR Communication\// }).getAttribute("href");
    const id = link!.split("/").pop()!;

    const comm = await (await request.get(`/fhir/Communication/${id}`)).json();
    expect(comm.resourceType).toBe("Communication");
    expect(comm.about[0].reference).toBe("Location/coselhas-coimbra");
    expect(comm.payload).toHaveLength(2);
    const after = await (await request.get("/fhir/Communication?about=Location/coselhas-coimbra")).json();
    expect(after.total).toBe((before.total ?? 0) + 1);

    const prov = await (await request.get(`/fhir/Provenance?target=Communication/${id}`)).json();
    const roles = prov.entry[0].resource.agent.map((a: { type: { coding: { code: string }[] } }) => a.type.coding[0].code);
    expect(roles).toEqual(["author", "verifier"]);
    expect(prov.entry[0].resource.agent[1].who.display).toBe("E2E Officer");

    // the approved advisory appears on the stream record
    await page.reload();
    await expect(page.getByLabel("Current advisory")).toContainText("E2E Officer");
    // a second decision is refused
    const again = await request.post(`/api/agent/plans/${id}`, { data: { decision: "discard", officer: "x" } });
    expect(again.status()).toBe(409);
    w.assertClean();
  });

  test("discarding publishes nothing", async ({ page, request }) => {
    await page.goto("/sites/calore-bn");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Response plan" }) });
    await panel.getByRole("button", { name: "Draft response plan" }).click();
    const plan = panel.getByTestId("response-plan");
    await expect(plan).toBeVisible({ timeout: remote ? 200_000 : 30_000 });
    await expect(plan.getByRole("button", { name: "Italian" })).toBeVisible();
    await plan.getByRole("button", { name: "Discard" }).click();
    await expect(plan.getByText("Discarded. Nothing was published.")).toBeVisible();
    const list = await (await request.get("/fhir/Communication?about=Location/calore-bn")).json();
    expect(list.total).toBe(0);
  });

  test("API validation", async ({ request }) => {
    expect((await request.post("/api/agent/plan", { data: { siteId: "nope" } })).status()).toBe(400);
    expect((await request.post("/api/agent/plans/nope", { data: { decision: "approve", officer: "x" } })).status()).toBe(404);
    expect((await request.post("/api/agent/plans/nope", { data: { decision: "maybe" } })).status()).toBe(400);
    expect((await request.get("/fhir/Communication/nope")).status()).toBe(404);
    const cap = await (await request.get("/fhir/metadata")).json();
    expect(cap.rest[0].resource.map((r: { type: string }) => r.type)).toContain("Communication");
  });
});
