import { requireUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { setObservationStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Coordinator review of citizen observations: verify (final) or send back (preliminary). */
export async function POST(req: Request) {
  const auth = await requireUser(["officer"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  const status = body?.status;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string") || ids.length > 50 || !["final", "preliminary"].includes(status))
    return json({ error: "expected { ids: string[] (max 50), status: 'final' | 'preliminary' }" }, 400);
  const updated = await setObservationStatus(ids, status);
  return json({ updated });
}
