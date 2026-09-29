// Calls the real Claude API. Skipped unless ANTHROPIC_API_KEY is set:
//   set -a; source .env.agent.local; set +a; npx vitest run tests/agent.live.test.ts
import { describe, expect, it } from "vitest";
import { runAgent, type AgentEvent } from "@/lib/agent/run";
import { resetStore } from "@/lib/store";

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("duty-officer agent (live)", () => {
  it("gathers evidence with tools and submits a valid plan", async () => {
    resetStore(); // in-memory demo data; never touches the real database
    const events: AgentEvent[] = [];
    const plan = await runAgent("giofyros-1", (e) => {
      events.push(e);
      if (e.type === "tool") console.log("tool:", e.name, JSON.stringify(e.input));
      if (e.type === "tool_result") console.log("  ->", e.summary);
      if (e.type === "note") console.log("note:", e.text.slice(0, 160));
      if (e.type === "error") console.log("ERROR:", e.message);
    });
    expect(events.find((e) => e.type === "error")).toBeUndefined();
    expect(plan).toBeDefined();
    const tools = events.filter((e) => e.type === "tool").map((e) => (e as { name: string }).name);
    expect(tools[0]).toBe("get_stream_risk");
    expect(tools.at(-1)).toBe("submit_response_plan");
    console.log(JSON.stringify(plan, null, 2));
  }, 240_000);
});
