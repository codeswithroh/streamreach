export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

export function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": `${contentType}; charset=utf-8`, ...CORS },
  });
}

export function baseUrl(req: Request) {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}`;
}
