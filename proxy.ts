import { NextRequest, NextResponse } from "next/server";
import { gateCookieName, verifyGateToken } from "@/lib/gate";

// Paths that must be reachable without the party-pass cookie:
// - the gate page itself and its submission endpoint
// - externally-triggered API routes (Supabase webhooks, GitHub Actions cron)
//   which carry their own auth and have no cookie to send.
const PUBLIC_PREFIXES = [
  "/gate",
  "/api/gate",
  "/api/cron",
  "/api/push/events",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.PARTY_GATE_SECRET;
  if (!secret) {
    // Misconfigured — fail open in development so the app still boots, but
    // log loudly. In production this should be set in Vercel env.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Gate misconfigured", { status: 500 });
  }

  const token = req.cookies.get(gateCookieName)?.value;
  const ok = await verifyGateToken(token, secret);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  const next = pathname + (search || "");
  if (next && next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff|woff2)$).*)",
  ],
};
