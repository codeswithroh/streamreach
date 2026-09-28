import fs from "node:fs";

export default async function setup() {
  fs.writeFileSync(".e2e-start", new Date().toISOString());
}
