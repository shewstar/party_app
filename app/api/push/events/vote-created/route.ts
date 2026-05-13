import { NextRequest, NextResponse } from "next/server";
import { authorizeWebhook, WebhookPayload } from "@/lib/push/webhook";
import { sendPushToAllExcept } from "@/lib/push/send";

type VoteItem = {
  id: string;
  proposer_id: string | null;
  text: string;
};

export async function POST(req: NextRequest) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as WebhookPayload<VoteItem> | null;
  if (!payload || payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const item = payload.record;
  const result = await sendPushToAllExcept(item.proposer_id, {
    title: "New vote",
    body: item.text,
    url: "/vote",
    tag: `vote-new-${item.id}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
