import { json } from "@/lib/http";
import { siteBundleById } from "@/lib/risk/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/sites/[id]">) {
  const { id } = await ctx.params;
  const sb = await siteBundleById(id);
  if (!sb) return json({ error: "not found" }, 404);
  return json({
    site: { id: sb.site.id, name: sb.site.name, city: sb.site.city },
    overall: sb.risk.overall,
    hazards: sb.risk.hazards.map((h) => ({ hazard: h.hazard, label: h.label, level: h.peak.level, p: h.peak.p, confidence: h.confidence })),
  });
}
