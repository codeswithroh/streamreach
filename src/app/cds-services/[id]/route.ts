import { patientViewCards, SERVICE_ID } from "@/lib/cds/service";
import { baseUrl, CORS, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/cds-services/[id]">) {
  const { id } = await ctx.params;
  if (id !== SERVICE_ID) return json({ error: `Unknown service ${id}` }, 404);
  const body = await req.json().catch(() => null);
  if (!body?.hook || !body?.hookInstance) return json({ error: "hook and hookInstance are required" }, 400);
  const { cards, _meta } = await patientViewCards(body, baseUrl(req));
  // _meta is non-standard; EHRs ignore unknown properties. Our demo EHR shows it.
  return json({ cards, systemActions: [], _meta });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
