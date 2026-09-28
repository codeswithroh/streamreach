import { FhirError, fhirGet, fhirPost, operationOutcome } from "@/lib/fhir/server";
import { baseUrl, CORS, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const FHIR_JSON = "application/fhir+json";

export async function GET(req: Request, ctx: RouteContext<"/fhir/[[...path]]">) {
  const { path = [] } = await ctx.params;
  const base = `${baseUrl(req)}/fhir`;
  try {
    if (!path.length) return json(await fhirGet(["metadata"], new URLSearchParams(), base), 200, FHIR_JSON);
    return json(await fhirGet(path, new URL(req.url).searchParams, base), 200, FHIR_JSON);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request, ctx: RouteContext<"/fhir/[[...path]]">) {
  const { path = [] } = await ctx.params;
  try {
    const body = await req.json().catch(() => {
      throw new FhirError(400, "Body must be FHIR JSON", "structure");
    });
    const r = await fhirPost(path, body);
    return json(r.body, r.status, FHIR_JSON);
  } catch (e) {
    return fail(e);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function fail(e: unknown) {
  if (e instanceof FhirError) return json(operationOutcome(e.status, e.message, e.code), e.status, FHIR_JSON);
  console.error(e);
  return json(operationOutcome(500, "Internal error"), 500, FHIR_JSON);
}
