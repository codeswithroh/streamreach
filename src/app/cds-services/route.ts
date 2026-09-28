import { DISCOVERY } from "@/lib/cds/service";
import { CORS, json } from "@/lib/http";

export function GET() {
  return json(DISCOVERY);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
