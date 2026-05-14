import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gateCookieMaxAge,
  gateCookieName,
  readGateClaims,
  signGateToken,
} from "@/lib/gate";

// Onboarding gate. Performs three jobs that can't be done from the browser:
//   1. Refuse a second user creation from the same device cookie (cookie
//      carries a v2 user_id claim once set).
//   2. Honour the roster_locked flag — once an organiser flips it on, this
//      endpoint stops minting new users.
//   3. Re-sign the gate cookie to embed the new user_id so the next call
//      sees the binding.
//
// The body is just { name }. Server mints the uuid so a client can't pick
// one — if a v2 cookie already exists, server returns its baked-in id.

export async function POST(req: NextRequest) {
  const secret = process.env.PARTY_GATE_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !anon) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: "name too long" }, { status: 400 });
  }

  const cookieToken = req.cookies.get(gateCookieName)?.value;
  const claims = await readGateClaims(cookieToken, secret);
  if (!claims.valid) {
    return NextResponse.json({ error: "no_party_pass" }, { status: 401 });
  }

  const supa = createClient(url, anon, { auth: { persistSession: false } });

  // Cookie already bound to a user — return that id (idempotent). Lets the
  // user re-run onboarding to fix their name without minting a duplicate.
  if (claims.userId) {
    const { data: existing } = await supa
      .from("users")
      .select("id, name")
      .eq("id", claims.userId)
      .maybeSingle();
    if (existing) {
      if (existing.name !== name) {
        await supa.from("users").update({ name }).eq("id", existing.id);
      }
      return NextResponse.json({ userId: existing.id, alreadyClaimed: true });
    }
    // Cookie says we claimed a user but no row exists (DB wiped between
    // sessions). Fall through and recreate with the same id so achievements
    // and any other localStorage state keyed on it still line up.
  }

  // New user — check the roster lock first.
  const { data: settings } = await supa
    .from("app_settings")
    .select("roster_locked")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.roster_locked) {
    return NextResponse.json(
      {
        error: "roster_locked",
        message: "The roster is locked. Ask the buck or organiser to unlock it.",
      },
      { status: 423 },
    );
  }

  const userId = claims.userId ?? crypto.randomUUID();
  const { error: insertErr } = await supa
    .from("users")
    .upsert({ id: userId, name }, { onConflict: "id" });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const newToken = await signGateToken(secret, userId);
  const res = NextResponse.json({ userId, alreadyClaimed: false });
  res.cookies.set(gateCookieName, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: gateCookieMaxAge,
  });
  return res;
}
