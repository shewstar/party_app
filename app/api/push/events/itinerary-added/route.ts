import { NextRequest, NextResponse } from "next/server";
import { authorizeWebhook, pushEnabled, WebhookPayload } from "@/lib/push/webhook";
import { sendPushToAllExcept } from "@/lib/push/send";

type ItineraryEvent = {
  id: string;
  title: string;
  created_by: string | null;
};

export async function POST(req: NextRequest) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ ok: true, skipped: "push_disabled" });
  }
  const payload = (await req.json().catch(() => null)) as WebhookPayload<ItineraryEvent> | null;
  if (!payload || payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const ev = payload.record;
  const result = await sendPushToAllExcept(ev.created_by, {
    title: "Added to itinerary",
    body: ev.title,
    url: "/itinerary",
    tag: `itinerary-${ev.id}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
