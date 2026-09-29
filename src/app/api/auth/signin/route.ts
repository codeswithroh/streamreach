import { authenticate, startSession } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!allow(`signin:${clientIp(req)}`, 10, 60_000)) return Response.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });
  const u = await authenticate(email, password);
  if (!u) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  await startSession(u.id);
  return Response.json({ ok: true, role: u.role });
}
