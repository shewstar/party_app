import { NextRequest, NextResponse } from "next/server";
import { authorizeWebhook, pushEnabled, WebhookPayload } from "@/lib/push/webhook";
import { sendPushToAllExcept } from "@/lib/push/send";
import { supabaseServer } from "@/lib/supabase/server";
import { MIN_YES_VOTES } from "@/lib/votes";

type VoteResponse = {
  vote_item_id: string;
  user_id: string;
  value: 1 | -1;
};

export async function POST(req: NextRequest) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ ok: true, skipped: "push_disabled" });
  }
  const payload = (await req.json().catch(() => null)) as WebhookPayload<VoteResponse> | null;
  if (!payload || !payload.record) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const voteItemId = payload.record.vote_item_id;
  const supa = supabaseServer();

  const { data: item, error: itemErr } = await supa
    .from("vote_items")
    .select("id, text, proposer_id, passed_at, rejected_at, repeals_vote_item_id")
    .eq("id", voteItemId)
    .maybeSingle();
  if (itemErr || !item) {
    return NextResponse.json({ error: "vote item not found" }, { status: 404 });
  }
  if (item.passed_at || item.rejected_at) {
    return NextResponse.json({ ok: true, skipped: "already_decided" });
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
  const againstCount = tally?.against_count ?? 0;
  const total = userCount ?? 0;
  // Lock only when both gates clear: strict majority of the user table AND
  // the absolute 6-vote floor that stops cards locking early in the night.
  const passes = total > 0 && forCount >= MIN_YES_VOTES && forCount > total / 2;
  const rejects = total > 0 && againstCount >= MIN_YES_VOTES && againstCount > total / 2;
  if (!passes && !rejects) {
    return NextResponse.json({
      ok: true,
      skipped: "below_threshold",
      forCount,
      againstCount,
      total,
      minVotes: MIN_YES_VOTES,
    });
  }

  const nowIso = new Date().toISOString();
  const decisionField = passes ? "passed_at" : "rejected_at";
  const { error: updateErr } = await supa
    .from("vote_items")
    .update({ [decisionField]: nowIso })
    .eq("id", voteItemId)
    .is(decisionField, null);
  if (updateErr) {
    console.error("[vote-passed] mark decision", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // A successful repeal *reopens* the original: clear its passed_at and
  // rejected_at so it returns to active voting. The repeal proposal itself
  // stays passed — it's now the rule that overturned the previous decision.
  // A rejected repeal does nothing to the original; it just locks itself.
  let reopenedText: string | null = null;
  if (passes && item.repeals_vote_item_id) {
    const { data: original } = await supa
      .from("vote_items")
      .select("id, text")
      .eq("id", item.repeals_vote_item_id)
      .maybeSingle();
    if (original) {
      reopenedText = original.text;
      const { error: reopenErr } = await supa
        .from("vote_items")
        .update({ passed_at: null, rejected_at: null })
        .eq("id", original.id);
      if (reopenErr) {
        console.error("[vote-passed] cascade reopen", reopenErr);
      }
    }
  }

  const pushTitle = passes ? "Voted in!" : "Voted out!";
  const pushBody = reopenedText ? `Reopened: ${reopenedText}` : item.text;
  const result = await sendPushToAllExcept(item.proposer_id, {
    title: pushTitle,
    body: pushBody,
    url: "/vote",
    tag: `vote-${passes ? "passed" : "rejected"}-${item.id}`,
  });
  return NextResponse.json({ ok: true, ...result });
}
