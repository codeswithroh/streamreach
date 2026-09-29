import { expect, test } from "@playwright/test";
import { AUTH, watchErrors } from "./helpers";

test.describe("landing and authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing page leads to sign-in", async ({ page }) => {
    const w = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("From streams");
    await page.getByRole("link", { name: /Try the live demo/ }).first().click();
    await expect(page).toHaveURL(/\/signin/);
    w.assertClean();
  });

  test("the app is protected and returns you where you were going", async ({ page }) => {
    await page.goto("/app/data?tab=lab");
    await expect(page).toHaveURL(/\/signin\?next=%2Fapp%2Fdata/);
    await page.getByRole("button", { name: /Continue as public-health officer/ }).click();
    await expect(page).toHaveURL(/\/app\/data\?tab=lab/);
  });

  test("demo access lands each role in the right place", async ({ page }) => {
    for (const [label, path] of [
      ["public-health officer", /\/app$/],
      ["citizen volunteer", /\/app\/check$/],
      ["clinician", /\/app\/clinic$/],
    ] as const) {
      await page.context().clearCookies();
      await page.goto("/signin");
      await page.getByRole("button", { name: new RegExp(`Continue as ${label}`) }).click();
      await expect(page).toHaveURL(path);
    }
  });

  test("sign up, sign out, sign in again, wrong password", async ({ page }) => {
    const email = `e2e-${Date.now()}-ui@example.test`;
    await page.goto("/signup");
    await page.getByRole("button", { name: "Clinician" }).click();
    await page.getByLabel("Full name").fill("E2E Clinician");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at least 8" })).toBeVisible();
    await page.getByLabel("Password").fill("e2e-password-123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app\/clinic$/);
    await expect(page.getByText("E2E Clinician")).toBeVisible();

    // duplicate email is refused
    const dup = await page.request.post("/api/auth/signup", { data: { name: "Dup User", email, password: "e2e-password-123", role: "citizen" } });
    expect(dup.status()).toBe(409);

    // sign out from the user menu
    await page.getByRole("button", { name: /E2E Clinician/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/signin/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
    await page.getByLabel("Password").fill("e2e-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/); // back to where the redirect started
  });

  test("officer accounts cannot be self-registered", async ({ request }) => {
    const r = await request.post("/api/auth/signup", { data: { name: "X", email: `e2e-${Date.now()}-o@example.test`, password: "e2e-password-123", role: "officer" } });
    expect(r.status()).toBe(400);
  });

  test("writes need a signed-in user", async ({ request }) => {
    expect((await request.post("/fhir", { data: { resourceType: "Bundle", type: "transaction", entry: [] } })).status()).toBe(401);
    expect((await request.post("/api/agent/plan", { data: { siteId: "giofyros-1" } })).status()).toBe(401);
    expect((await request.post("/api/observations/status", { data: { ids: ["x"], status: "final" } })).status()).toBe(401);
    // reads stay open for interoperability
    expect((await request.get("/fhir/Location")).status()).toBe(200);
    expect((await request.get("/cds-services")).status()).toBe(200);
  });
});

test.describe("role-based access", () => {
  test.use({ storageState: AUTH.citizen });

  test("a citizen cannot verify checks or run the AI agent", async ({ page, request }) => {
    expect((await request.post("/api/observations/status", { data: { ids: ["x"], status: "final" } })).status()).toBe(403);
    expect((await request.post("/api/agent/plan", { data: { siteId: "giofyros-1" } })).status()).toBe(403);
    expect((await request.post("/api/agent/plans/x", { data: { decision: "approve" } })).status()).toBe(403);
    await page.goto("/app/streams/giofyros-1");
    await expect(page.getByText(/Sign in as an officer to use the agent/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft response plan" })).toBeDisabled();
    await page.goto("/app/data?tab=queue");
    await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(0);
  });
});
