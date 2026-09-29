import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the app layout verifies the session against the database.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("sr_session")) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
