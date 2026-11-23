import { NextRequest, NextResponse } from "next/server";

/**
 * Password-protects the internal tool (search, scoping, review, proposal list) with HTTP Basic auth.
 * Shareable proposal pages (/p/<id>) and their deck downloads stay public — the IDs are unguessable.
 * Set APP_PASSWORD (and optionally APP_USERNAME, default "leadg2") to turn it on.
 */
const PUBLIC = [/^\/api\/health$/, /^\/p\/[^/]+\/?$/, /^\/api\/proposals\/[^/]+\/pptx\/?$/, /^\/api\/proposals\/[^/]+\/?$/];

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((re) => re.test(pathname)) && req.method === "GET" && pathname !== "/api/proposals";
  if (isPublic) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [user, pass] = atob(header.slice(6)).split(":");
    if (user === (process.env.APP_USERNAME || "leadg2") && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LeadG2 Scoping Agent"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|favicon.ico).*)"],
};
