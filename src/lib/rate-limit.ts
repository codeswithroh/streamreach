// Tiny per-instance sliding-window limiter (best effort on serverless).
const g = globalThis as unknown as { __srRate?: Map<string, number[]> };

export function allow(key: string, max: number, windowMs: number) {
  const m = (g.__srRate ??= new Map<string, number[]>());
  const now = Date.now();
  const hits = (m.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (hits.length >= max) {
    m.set(key, hits);
    return false;
  }
  hits.push(now);
  m.set(key, hits);
  return true;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
