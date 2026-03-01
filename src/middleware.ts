import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes always public — ingest APIs use their own x-mc-token auth
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/agents",
  "/api/dashboard/agent-stats-sync",
  "/api/dashboard/agents-sync",
  "/api/dashboard/cron-sync",
  "/api/dashboard/dispatch-watchdog",
  "/api/dashboard/events",
  "/api/dashboard/health",
  "/api/dashboard/projects-sync",
  "/api/dashboard/task-dispatch",
  "/api/internal",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // req.auth is null when not authenticated
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Protect everything except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
