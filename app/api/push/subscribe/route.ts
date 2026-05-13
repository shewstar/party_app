import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { userId, endpoint, p256dh, auth, userAgent } = body as {
    userId?: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    userAgent?: string;
  };
  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const supa = supabaseServer();
  const { error } = await supa
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error("[push/subscribe]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
