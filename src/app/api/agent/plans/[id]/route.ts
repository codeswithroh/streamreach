import { json } from "@/lib/http";
import { decidePlan, getPlan } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/agent/plans/[id]">) {
  const { id } = await ctx.params;
  const p = await getPlan(id);
  return p ? json(p) : json({ error: "not found" }, 404);
}

/** Human decision on an AI-drafted plan: { decision: "approve" | "discard", officer: string }. */
export async function POST(req: Request, ctx: RouteContext<"/api/agent/plans/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  const officer = typeof body?.officer === "string" ? body.officer.trim().slice(0, 80) : "";
  if (!["approve", "discard"].includes(decision) || !officer) return json({ error: "expected { decision: 'approve' | 'discard', officer }" }, 400);
  const existing = await getPlan(id);
  if (!existing) return json({ error: "not found" }, 404);
  const p = await decidePlan(id, decision === "approve" ? "approved" : "discarded", officer);
  if (!p) return json({ error: `plan is already ${existing.status}` }, 409);
  return json(p);
}
