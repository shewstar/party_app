import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  const supa = supabaseServer();
  const { error } = await supa.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error("[push/unsubscribe]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
