import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Auth strategy:
 *
 * 1. /login and /api/auth/* — always public (auth flow itself)
 * 2. /api/* routes — NEVER redirect to /login:
 *    a. If request carries a valid x-mc-token → allow (server-to-server)
 *    b. If request has a valid session JWT → allow (browser-originated)
 *    c. Otherwise → 401 JSON (never 307 redirect)
 * 3. UI pages (non-API) — redirect to /login when not authenticated
 */

const VALID_TOKEN = process.env.MC_API_TOKEN ?? process.env.MC_TOKEN ?? "";

function hasValidToken(req: Request): boolean {
  if (!VALID_TOKEN) return false;
  const provided = req.headers.get("x-mc-token");
  return provided === VALID_TOKEN;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Always allow the login page and NextAuth internals
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // ── API routes — never redirect, always return JSON errors ────────────────
  if (pathname.startsWith("/api/")) {
    // Server-to-server: valid x-mc-token → pass
    if (hasValidToken(req)) return NextResponse.next();

    // Browser session: valid JWT → pass
    if (req.auth) return NextResponse.next();

    // No valid auth → 401 JSON (never redirect)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── UI pages — redirect to login when not authenticated ──────────────────
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
