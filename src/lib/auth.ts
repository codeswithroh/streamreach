// Authentication: email + password (scrypt), database sessions with an opaque
// random token in an httpOnly cookie (only its SHA-256 hash is stored), and
// three roles. Demo accounts give judges one-click access.
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  createSessionRecord,
  createUser,
  deleteSessionRecord,
  findUserByEmail,
  sessionUser,
  type Role,
  type UserRecord,
} from "./store";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "sr_session";
const SESSION_DAYS = 7;

export type { Role };

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** pseudonymous code used on citizen observations */
  volunteerCode: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Citizen volunteer",
  officer: "Public-health officer",
  clinician: "Clinician",
};

export const DEMO_ACCOUNTS: Record<Role, { email: string; name: string }> = {
  citizen: { email: "citizen@demo.streamreach.io", name: "Elena Papadaki" },
  officer: { email: "officer@demo.streamreach.io", name: "Dr. Marco Russo" },
  clinician: { email: "clinician@demo.streamreach.io", name: "Dr. Ingrid Berg" },
};

export function volunteerCode(userId: string) {
  const h = createHash("sha256").update(userId).digest();
  return `V-${h.readUInt32BE(0).toString(36).toUpperCase().slice(0, 4)}`;
}

function toUser(u: UserRecord): User {
  return { id: u.id, name: u.name, email: u.email, role: u.role, volunteerCode: volunteerCode(u.id) };
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(pw, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("base64url");
export const normaliseEmail = (e: string) => e.trim().toLowerCase();

export async function registerUser(input: { name: string; email: string; password: string; role: Role }) {
  const u: UserRecord = {
    id: `usr-${randomUUID()}`,
    email: normaliseEmail(input.email),
    name: input.name.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  return (await createUser(u)) ? u : undefined;
}

export async function authenticate(email: string, password: string) {
  const u = await findUserByEmail(normaliseEmail(email));
  // verify against a dummy hash when the user is unknown, so timing doesn't reveal which emails exist
  const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  return u && ok ? u : undefined;
}

/** Get (or lazily create) the demo account for a role. */
export async function demoUser(role: Role) {
  const acct = DEMO_ACCOUNTS[role];
  const existing = await findUserByEmail(acct.email);
  if (existing) return existing;
  await registerUser({ ...acct, role, password: randomBytes(24).toString("base64url") });
  return (await findUserByEmail(acct.email))!;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await createSessionRecord(hashToken(token), userId, expires.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionRecord(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, verified against the session table (memoised per render). */
export const getCurrentUser = cache(async (): Promise<User | undefined> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  const u = await sessionUser(hashToken(token));
  return u && toUser(u);
});

/** For route handlers: the user if signed in and allowed, else a ready-made error response. */
export async function requireUser(roles?: Role[]): Promise<{ user: User } | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: Response.json({ error: "Sign in required" }, { status: 401 }) };
  if (roles && !roles.includes(user.role)) return { response: Response.json({ error: `Requires role: ${roles.join(" or ")}` }, { status: 403 }) };
  return { user };
}
