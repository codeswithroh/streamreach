import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

/** When the suite ran against production, delete everything it created. */
export default async function teardown() {
  if (!process.env.E2E_BASE_URL) return;
  let url = process.env.DATABASE_URL;
  if (!url && fs.existsSync(".env.local")) url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
  if (!url) return console.warn("teardown: no DATABASE_URL, skipping cleanup");
  const sql = neon(url);
  const since = fs.existsSync(".e2e-start") ? fs.readFileSync(".e2e-start", "utf8").trim() : new Date(Date.now() - 3600_000).toISOString();
  const state = fs.existsSync("e2e/.auth/state.json") ? JSON.parse(fs.readFileSync("e2e/.auth/state.json", "utf8")) : {};
  const obs = await sql.query(
    `delete from observations where origin = 'user' and (performer->>'id' = $1 or performer->>'id' like 'V-E2E%') returning id`,
    [state.citizenCode ?? "-"],
  );
  const sig = await sql.query(`delete from signals where origin = 'user' and created_at >= $1 returning id`, [since]);
  const users = await sql.query(`delete from users where email like 'e2e-%@example.test' returning id`);
  console.log(`teardown: removed ${obs.length} observations, ${sig.length} signals, ${users.length} test users`);
}
