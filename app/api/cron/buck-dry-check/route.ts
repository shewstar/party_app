import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/push/webhook";
import { sendPushToAllExcept } from "@/lib/push/send";
import { supabaseServer } from "@/lib/supabase/server";

const DRY_WINDOW_MS = 60 * 60 * 1000;
const RENOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supa = supabaseServer();

  const { data: buck } = await supa
    .from("users")
    .select("id, name")
    .eq("is_buck", true)
    .maybeSingle();
  if (!buck) return NextResponse.json({ ok: true, skipped: "no_buck" });

  const { data: lastDrink } = await supa
    .from("drink_entries")
    .select("logged_at")
    .eq("user_id", buck.id)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const lastDrinkAt = lastDrink?.logged_at ? new Date(lastDrink.logged_at).getTime() : null;
  const dry = lastDrinkAt === null || now - lastDrinkAt > DRY_WINDOW_MS;
  if (!dry) {
    return NextResponse.json({ ok: true, skipped: "buck_recently_drank" });
  }

  const { data: state } = await supa
    .from("buck_dry_state")
    .select("last_notified_at, last_drink_at")
    .eq("id", 1)
    .maybeSingle();
  const lastNotified = state?.last_notified_at ? new Date(state.last_notified_at).getTime() : 0;
  const lastSeenDrink = state?.last_drink_at ?? null;
  const currentDrinkStamp = lastDrink?.logged_at ?? null;

  if (
    lastNotified &&
    now - lastNotified < RENOTIFY_COOLDOWN_MS &&
    lastSeenDrink === currentDrinkStamp
  ) {
    return NextResponse.json({ ok: true, skipped: "already_notified" });
  }

  const result = await sendPushToAllExcept(buck.id, {
    title: "Buck's gone dry 🍺",
    body: `${buck.name} hasn't had a drink in over an hour.`,
    url: "/",
    tag: "buck-dry",
  });

  await supa
    .from("buck_dry_state")
    .upsert({
      id: 1,
      last_notified_at: new Date(now).toISOString(),
      last_drink_at: currentDrinkStamp,
    });

  return NextResponse.json({ ok: true, ...result });
}
