import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware cannot use node:crypto, so it only checks that a session cookie exists;
 * the token itself is verified in the server layout (lib/auth.ts) on every request.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }
  if (!req.cookies.get("hb_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
