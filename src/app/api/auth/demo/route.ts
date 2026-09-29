import { demoUser, startSession, type Role } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

/** One-click demo access for judges: signs in as the shared demo account for a role. */
export async function POST(req: Request) {
  if (!allow(`demo:${clientIp(req)}`, 20, 60_000)) return Response.json({ error: "Too many requests." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const role = body?.role as Role;
  if (!["citizen", "officer", "clinician"].includes(role)) return Response.json({ error: "Unknown role." }, { status: 400 });
  const u = await demoUser(role);
  await startSession(u.id);
  return Response.json({ ok: true, role });
}
