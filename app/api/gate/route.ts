import { NextRequest, NextResponse } from "next/server";
import {
  gateCookieMaxAge,
  gateCookieName,
  signGateToken,
  timingSafeStringEqual,
} from "@/lib/gate";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/gate") || raw.startsWith("/api/gate")) return "/";
  return raw;
}

export async function POST(req: NextRequest) {
  const password = process.env.PARTY_PASSWORD;
  const secret = process.env.PARTY_GATE_SECRET;
  if (!password || !secret) {
    return NextResponse.json(
      { error: "gate not configured" },
      { status: 500 },
    );
  }

  const form = await req.formData().catch(() => null);
  const submitted = form?.get("password");
  const next = safeNext(typeof form?.get("next") === "string" ? (form?.get("next") as string) : null);

  if (typeof submitted !== "string" || !timingSafeStringEqual(submitted, password)) {
    const url = new URL("/gate", req.url);
    url.searchParams.set("error", "1");
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = await signGateToken(secret);
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(gateCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: gateCookieMaxAge,
  });
  return res;
}
