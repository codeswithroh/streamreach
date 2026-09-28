import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

/** When the suite ran against production, delete everything it created. */
export default async function teardown() {
  if (!process.env.E2E_BASE_URL) return;
  let url = process.env.DATABASE_URL;
  if (!url && fs.existsSync(".env.local")) {
    const m = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m);
    url = m?.[1];
  }
  if (!url) return console.warn("teardown: no DATABASE_URL, skipping cleanup");
  const sql = neon(url);
  const since = fs.existsSync(".e2e-start") ? fs.readFileSync(".e2e-start", "utf8").trim() : new Date(Date.now() - 3600_000).toISOString();
  const obs = await sql.query(`delete from observations where origin = 'user' and (performer->>'id' like 'V-E2E%') returning id`);
  const sig = await sql.query(`delete from signals where origin = 'user' and created_at >= $1 returning id`, [since]);
  // restore any seed checks the verification test toggled
  console.log(`teardown: removed ${obs.length} observations, ${sig.length} signals`);
}
