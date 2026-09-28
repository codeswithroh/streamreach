import { handleFeedback, SERVICE_ID } from "@/lib/cds/service";
import { CORS, json } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/cds-services/[id]/feedback">) {
  const { id } = await ctx.params;
  if (id !== SERVICE_ID) return json({ error: `Unknown service ${id}` }, 404);
  const body = await req.json().catch(() => null);
  const recorded = await handleFeedback(body);
  return json({ recorded });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
