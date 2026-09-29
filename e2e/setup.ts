import { request, type FullConfig } from "@playwright/test";
import fs from "node:fs";

/** Sign in once per role and save the sessions for the tests to reuse. */
export default async function setup(config: FullConfig) {
  fs.writeFileSync(".e2e-start", new Date().toISOString());
  const baseURL = config.projects[0].use.baseURL!;
  fs.mkdirSync("e2e/.auth", { recursive: true });
  for (const role of ["officer", "clinician"]) {
    const ctx = await request.newContext({ baseURL });
    const r = await ctx.post("/api/auth/demo", { data: { role } });
    if (!r.ok()) throw new Error(`demo sign-in failed for ${role}: ${r.status()}`);
    await ctx.storageState({ path: `e2e/.auth/${role}.json` });
    await ctx.dispose();
  }
  // a fresh citizen account per run, so everything it creates can be removed afterwards
  const ctx = await request.newContext({ baseURL });
  const email = `e2e-${Date.now()}@example.test`;
  const r = await ctx.post("/api/auth/signup", { data: { name: "E2E Citizen", email, password: "e2e-password-123", role: "citizen" } });
  if (!r.ok()) throw new Error(`citizen sign-up failed: ${r.status()} ${await r.text()}`);
  const me = await (await ctx.get("/api/auth/me")).json();
  await ctx.storageState({ path: "e2e/.auth/citizen.json" });
  await ctx.dispose();
  fs.writeFileSync("e2e/.auth/state.json", JSON.stringify({ citizenEmail: email, citizenCode: me.user.volunteerCode }));
}
