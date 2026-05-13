import { NextRequest, NextResponse } from "next/server";
import { authorizeWebhook, WebhookPayload } from "@/lib/push/webhook";
import { sendPushToAllExcept } from "@/lib/push/send";
import { supabaseServer } from "@/lib/supabase/server";

type VoteResponse = {
  vote_item_id: string;
  user_id: string;
  value: 1 | -1;
};

export async function POST(req: NextRequest) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as WebhookPayload<VoteResponse> | null;
  if (!payload || !payload.record) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const voteItemId = payload.record.vote_item_id;
  const supa = supabaseServer();

  const { data: item, error: itemErr } = await supa
    .from("vote_items")
    .select("id, text, proposer_id, passed_at")
    .eq("id", voteItemId)
    .maybeSingle();
  if (itemErr || !item) {
    return NextResponse.json({ error: "vote item not found" }, { status: 404 });
  }
  if (item.passed_at) {
    return NextResponse.json({ ok: true, skipped: "already_passed" });
  }

  const [{ data: tally }, { count: userCount }] = await Promise.all([
    supa
      .from("v_vote_tally")
      .select("for_count, against_count")
      .eq("id", voteItemId)
      .maybeSingle(),
    supa.from("users").select("id", { count: "exact", head: true }),
  ]);

  const forCount = tally?.for_count ?? 0;
  const total = userCount ?? 0;
  if (total === 0 || forCount <= total / 2) {
    return NextResponse.json({ ok: true, skipped: "no_majority", forCount, total });
  }

  const { error: updateErr } = await supa
    .from("vote_items")
    .update({ passed_at: new Date().toISOString() })
    .eq("id", voteItemId)
    .is("passed_at", null);
  if (updateErr) {
    console.error("[vote-passed] mark passed", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const result = await sendPushToAllExcept(item.proposer_id, {
    title: "Voted in!",
    body: item.text,
    url: "/vote",
    tag: `vote-passed-${item.id}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
