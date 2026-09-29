import { normaliseEmail, registerUser, startSession, type Role } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

const SELF_SERVICE_ROLES: Role[] = ["citizen", "clinician"];

export async function POST(req: Request) {
  if (!allow(`signup:${clientIp(req)}`, 5, 60_000)) return Response.json({ error: "Too many sign-ups. Wait a minute and try again." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? normaliseEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = (body?.role ?? "citizen") as Role;
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8 || password.length > 200) return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  // Officer accounts are provisioned by the city, not self-service.
  if (!SELF_SERVICE_ROLES.includes(role)) return Response.json({ error: "Choose citizen volunteer or clinician." }, { status: 400 });
  const u = await registerUser({ name, email, password, role });
  if (!u) return Response.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
  await startSession(u.id);
  return Response.json({ ok: true, role: u.role }, { status: 201 });
}
