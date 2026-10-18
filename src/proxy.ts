import { NextResponse, type NextRequest } from "next/server";

import { adminEnabled, isAdminAuthorization } from "@/lib/auth/admin";

/**
 * Gate /admin behind HTTP Basic auth. This is the one place that can answer
 * with a 401 challenge, so the browser shows its password prompt; the admin
 * page and its actions re-check the same header themselves.
 */
export function proxy(request: NextRequest) {
  if (!adminEnabled()) return new NextResponse(null, { status: 404 });
  if (isAdminAuthorization(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Autentificare necesară.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Tenuto admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
