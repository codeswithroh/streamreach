import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL unset: build and run a local production server on an in-memory store (no writes to the real DB).
// E2E_BASE_URL=https://streamreach-health.vercel.app: run against production; rows created by the suite are
// removed in global teardown.
const remote = process.env.E2E_BASE_URL;
const baseURL = remote ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: remote ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  globalSetup: "./e2e/setup.ts",
  globalTeardown: "./e2e/teardown.ts",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", storageState: "e2e/.auth/officer.json" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: remote
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://localhost:3100/fhir/metadata",
        timeout: 240_000,
        reuseExistingServer: false,
        env: { DATABASE_URL: "", POSTGRES_URL: "", STREAMREACH_AGENT_MOCK: "1" },
      },
});
