"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { useHaptic } from "@/lib/haptics";
import { SkeletonCard } from "@/components/Skeleton";
import { useTableData } from "@/lib/realtime-provider";
import type { UserRow, VoteItemRow, VoteResponseRow, VoteTallyRow } from "@/lib/supabase/types";
import clsx from "@/components/clsx";
import { burstVote } from "@/lib/confetti";
import { effectiveThreshold, MIN_YES_VOTES } from "@/lib/votes";

// Full-card background fills. Width is the share of total voters: 7 For
// votes out of 10 users fills 70% of the card width from the left. The
// midline marks the 50% mark — crossing it = strict majority of the room.
function MajorityFill({
  forCount,
  againstCount,
  totalVoters,
  passed,
  rejected,
}: {
  forCount: number;
  againstCount: number;
  totalVoters: number;
  passed: boolean;
  rejected: boolean;
}) {
  if (totalVoters < 2) return null;
  const forPct = Math.min(100, (forCount / totalVoters) * 100);
  const againstPct = Math.min(100, (againstCount / totalVoters) * 100);
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div
        className={clsx(
          "absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none",
          passed ? "bg-accent/30" : "bg-accent/15",
        )}
        style={{ width: `${forPct}%` }}
      />
      <div
        className={clsx(
          "absolute inset-y-0 right-0 transition-[width] duration-300 motion-reduce:transition-none",
          rejected ? "bg-danger/30" : "bg-danger/15",
        )}
        style={{ width: `${againstPct}%` }}
      />
    </div>
  );
}

function MajorityCaption({
  forCount,
  againstCount,
  totalVoters,
  passed,
  rejected,
}: {
  forCount: number;
  againstCount: number;
  totalVoters: number;
  passed: boolean;
  rejected: boolean;
}) {
  if (totalVoters < 2) return null;
  const threshold = effectiveThreshold(totalVoters);
  // Whichever side is closer to its threshold drives the countdown — e.g. with
  // 10 users and 4 For/0 Against, "Needs 2 to pass". Ties prefer the pass
  // direction since that's the headline outcome.
  const needPass = Math.max(0, threshold - forCount);
  const needReject = Math.max(0, threshold - againstCount);
  const status = passed
    ? "Passed"
    : rejected
      ? "Rejected"
      : needPass <= needReject
        ? `Needs ${needPass} to pass`
        : `Needs ${needReject} to reject`;
  return (
    <div className="flex justify-between text-[10px] text-muted tabular-nums">
      <span>
        {forCount}/{threshold}
      </span>
      <span className="text-ink/60">{status}</span>
      <span>
        {againstCount}/{threshold}
      </span>
    </div>
  );
}

const VoteCard = memo(function VoteCard({
  item, myVote, onVote, totalVoters, passed, rejected, hasActiveRepeal, originalText, onProposeRepeal,
}: {
  item: VoteTallyRow;
  myVote: 1 | -1 | undefined;
  onVote: (item: VoteTallyRow, value: 1 | -1) => void;
  totalVoters: number;
  passed: boolean;
  rejected: boolean;
  hasActiveRepeal: boolean;
  originalText: string | null;
  onProposeRepeal: (item: VoteTallyRow) => void;
}) {
  const lockedIn = passed;
  const lockedOut = rejected;
  const locked = lockedIn || lockedOut;
  return (
    <li
      className={clsx(
        "relative overflow-hidden rounded-card shadow-card border",
        lockedIn && "bg-accentSoft border-accent ring-1 ring-accent/30",
        lockedOut && "bg-danger/10 border-danger ring-1 ring-danger/30",
        !locked && "bg-surface border-line",
      )}
    >
      <MajorityFill
        forCount={item.for_count}
        againstCount={item.against_count}
        totalVoters={totalVoters}
        passed={passed}
        rejected={rejected}
      />
      <div className="relative z-10 p-4 flex flex-col gap-3">
        {originalText && (
          <div className="text-xs text-muted flex items-center gap-1">
            <span aria-hidden>↩</span>
            <span className="truncate">Repeal of &ldquo;{originalText}&rdquo;</span>
          </div>
        )}
        <div className="flex justify-between items-start gap-3">
          <span className="flex-1">{item.text}</span>
          {lockedIn ? (
            <span className="text-[10px] uppercase tracking-wide font-semibold bg-accent text-white rounded-full px-2 py-0.5">
              Passed
            </span>
          ) : lockedOut ? (
            <span className="text-[10px] uppercase tracking-wide font-semibold bg-danger text-white rounded-full px-2 py-0.5">
              Rejected
            </span>
          ) : (
            <span
              className={clsx(
                "tabular-nums font-semibold text-sm",
                item.net > 0 && "text-accent",
                item.net < 0 && "text-danger",
                item.net === 0 && "text-muted",
              )}
            >
              {item.net > 0 ? `+${item.net}` : item.net}
            </span>
          )}
        </div>
        {!locked && (
          <div className="flex gap-2">
            <button
              onClick={() => onVote(item, 1)}
              className={clsx(
                "flex-1 rounded-card border px-3 py-2 font-medium",
                myVote === 1
                  ? "bg-accent text-white border-accent"
                  : "bg-surface text-ink border-line",
              )}
            >
              👍 For · {item.for_count}
            </button>
            <button
              onClick={() => onVote(item, -1)}
              className={clsx(
                "flex-1 rounded-card border px-3 py-2 font-medium",
                myVote === -1
                  ? "bg-danger text-white border-danger"
                  : "bg-surface text-ink border-line",
              )}
            >
              👎 Against · {item.against_count}
            </button>
          </div>
        )}
        <MajorityCaption
          forCount={item.for_count}
          againstCount={item.against_count}
          totalVoters={totalVoters}
          passed={passed}
          rejected={rejected}
        />
        {locked && hasActiveRepeal && (
          <span className="text-xs text-muted italic self-end">Repeal vote in progress…</span>
        )}
        {locked && !hasActiveRepeal && (
          <button
            type="button"
            onClick={() => onProposeRepeal(item)}
            className="text-xs text-muted underline self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Propose to repeal
          </button>
        )}
      </div>
    </li>
  );
});

export default function VotePage() {
  const { user, loading } = useUser();
  const haptic = useHaptic();
  const { data: tallyRaw } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: rawResponses } = useTableData<VoteResponseRow>("vote_responses");
  const { data: voteItemsRaw } = useTableData<VoteItemRow>("vote_items");
  const { data: usersRaw } = useTableData<UserRow>("users");
  const totalVoters = usersRaw.length;
  const passedById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const v of voteItemsRaw) m.set(v.id, v.passed_at !== null);
    return m;
  }, [voteItemsRaw]);
  const rejectedById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const v of voteItemsRaw) m.set(v.id, v.rejected_at !== null);
    return m;
  }, [voteItemsRaw]);
  // originalId → undecided repeal vote_item currently in flight. Used to
  // suppress the "Propose to repeal" button while a repeal is already open,
  // and to stop us from queueing duplicates. Decided repeals don't block a
  // new one — if the original locks again later it can be repealed again.
  const activeRepealByOriginalId = useMemo(() => {
    const m = new Map<string, VoteItemRow>();
    for (const v of voteItemsRaw) {
      if (!v.repeals_vote_item_id) continue;
      if (v.passed_at || v.rejected_at) continue;
      m.set(v.repeals_vote_item_id, v);
    }
    return m;
  }, [voteItemsRaw]);
  const itemTextById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of voteItemsRaw) m.set(v.id, v.text);
    return m;
  }, [voteItemsRaw]);
  // repealId → original item text; this card *is* a repeal proposal.
  const repealsByOriginalId = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of voteItemsRaw) {
      if (v.repeals_vote_item_id) {
        m.set(v.id, itemTextById.get(v.repeals_vote_item_id) ?? "");
      }
    }
    return m;
  }, [voteItemsRaw, itemTextById]);
  const [items, setItems] = useState<VoteTallyRow[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const myVotesRef = useRef(myVotes);
  myVotesRef.current = myVotes;
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  type SortKey = "newest" | "popular" | "controversial" | "decision";
  type FilterKey = "all" | "active" | "passed" | "rejected" | "unvoted";
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<FilterKey>("active");

  const tallyData = tallyRaw as VoteTallyRow[];
  const responses = rawResponses as VoteResponseRow[];

  // Sync items from provider when not in the middle of optimistic update
  const optimisticRef = useRef(false);
  useEffect(() => {
    if (optimisticRef.current) return;
    setItems([...tallyData].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ));
  }, [tallyData]);

  useEffect(() => {
    const map: Record<string, 1 | -1> = {};
    for (const r of responses) {
      if (r.user_id === user?.id) map[r.vote_item_id] = r.value;
    }
    setMyVotes(map);
  }, [responses, user]);

  // Client-side decision detection — mirrors the server route. Locks the
  // card as passed when For crosses the threshold, or rejected when Against
  // does. Idempotent (is-null guards), so racing clients are fine even when
  // the Supabase webhook is also wired up.
  const decisionAttemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || totalVoters < 1) return;
    const itemById = new Map(voteItemsRaw.map((v) => [v.id, v]));
    // Reset attempt tracking for any item that's been reopened (a successful
    // repeal cleared its decision). Without this, a re-locked card would
    // never fire its second decision update.
    for (const v of voteItemsRaw) {
      if (!v.passed_at && !v.rejected_at) {
        decisionAttemptedRef.current.delete(v.id);
      }
    }
    for (const v of tallyData) {
      const item = itemById.get(v.id);
      if (!item || item.passed_at || item.rejected_at) continue;
      const passes = v.for_count >= MIN_YES_VOTES && v.for_count > totalVoters / 2;
      const rejects = v.against_count >= MIN_YES_VOTES && v.against_count > totalVoters / 2;
      if (!passes && !rejects) continue;
      if (decisionAttemptedRef.current.has(v.id)) continue;
      decisionAttemptedRef.current.add(v.id);
      const nowIso = new Date().toISOString();
      const field = passes ? "passed_at" : "rejected_at";
      (async () => {
        const s = supabase();
        await s
          .from("vote_items")
          .update({ [field]: nowIso })
          .eq("id", v.id)
          .is(field, null);
        // A passing repeal reopens the original (clears its decision so it
        // returns to active voting). A rejected repeal does nothing to the
        // original.
        if (passes && item.repeals_vote_item_id) {
          await s
            .from("vote_items")
            .update({ passed_at: null, rejected_at: null })
            .eq("id", item.repeals_vote_item_id);
        }
      })();
    }
  }, [tallyData, voteItemsRaw, totalVoters, user]);

  // Fire confetti when a vote transitions from unpassed to passed. We seed the
  // ref with currently-passed items on first render so we don't celebrate
  // already-known wins on page mount.
  const seenPassedRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenPassedRef.current === null) {
      seenPassedRef.current = new Set(
        voteItemsRaw.filter((v) => v.passed_at !== null).map((v) => v.id),
      );
      return;
    }
    for (const v of voteItemsRaw) {
      if (v.passed_at && !seenPassedRef.current.has(v.id)) {
        seenPassedRef.current.add(v.id);
        burstVote();
      }
    }
  }, [voteItemsRaw]);

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setPosting(true);
    const s = supabase();
    const { data: inserted } = await s
      .from("vote_items")
      .insert({ proposer_id: user.id, text: text.trim() })
      .select("id")
      .single();
    if (inserted?.id) {
      await s.from("vote_responses").insert({
        vote_item_id: inserted.id,
        user_id: user.id,
        value: 1,
      });
    }
    setText("");
    setPosting(false);
  }

  const proposeRepeal = useCallback(async (target: VoteTallyRow) => {
    if (!user) return;
    // Don't open a second repeal vote while one is already in flight on this item.
    if (activeRepealByOriginalId.has(target.id)) return;
    haptic.medium();
    const s = supabase();
    const { data: inserted } = await s
      .from("vote_items")
      .insert({
        proposer_id: user.id,
        text: `Repeal: ${target.text}`,
        repeals_vote_item_id: target.id,
      })
      .select("id")
      .single();
    if (inserted?.id) {
      await s.from("vote_responses").insert({
        vote_item_id: inserted.id,
        user_id: user.id,
        value: 1,
      });
    }
  }, [user, haptic, activeRepealByOriginalId]);

  const castVote = useCallback(async (item: VoteTallyRow, value: 1 | -1) => {
    if (!user) return;
    haptic.medium();
    const previous = myVotesRef.current[item.id];
    if (previous === value) {
      optimisticRef.current = true;
      setMyVotes((m) => {
        const { [item.id]: _drop, ...rest } = m;
        return rest;
      });
      setItems((arr) =>
        arr.map((v) =>
          v.id === item.id
            ? {
                ...v,
                for_count: v.for_count - (value === 1 ? 1 : 0),
                against_count: v.against_count - (value === -1 ? 1 : 0),
                net: v.net - value,
              }
            : v,
        ),
      );
      await supabase()
        .from("vote_responses")
        .delete()
        .eq("vote_item_id", item.id)
        .eq("user_id", user.id);
      optimisticRef.current = false;
      return;
    }
    optimisticRef.current = true;
    setMyVotes((m) => ({ ...m, [item.id]: value }));
    setItems((arr) =>
      arr.map((v) => {
        if (v.id !== item.id) return v;
        let { for_count, against_count } = v;
        if (previous === 1) for_count--;
        if (previous === -1) against_count--;
        if (value === 1) for_count++;
        else against_count++;
        return { ...v, for_count, against_count, net: for_count - against_count };
      }),
    );
    await supabase()
      .from("vote_responses")
      .upsert(
        { vote_item_id: item.id, user_id: user.id, value, updated_at: new Date().toISOString() },
        { onConflict: "vote_item_id,user_id" },
      );
    optimisticRef.current = false;
  }, [user, haptic]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "unvoted") list = list.filter((v) => myVotes[v.id] === undefined);
    else if (filter === "active") list = list.filter((v) => !passedById.get(v.id) && !rejectedById.get(v.id));
    else if (filter === "passed") list = list.filter((v) => passedById.get(v.id));
    else if (filter === "rejected") list = list.filter((v) => rejectedById.get(v.id));
    // "Closest to a decision" — smallest gap between either side and the
    // threshold, ascending. Already-decided cards are pushed to the bottom
    // (their gap is 0 but they're not interesting for "what's about to lock").
    const threshold = effectiveThreshold(totalVoters);
    const gapTo = (v: VoteTallyRow) =>
      Math.min(
        Math.max(0, threshold - v.for_count),
        Math.max(0, threshold - v.against_count),
      );
    const isDecided = (v: VoteTallyRow) => passedById.get(v.id) || rejectedById.get(v.id);
    if (sort === "popular") list = [...list].sort((a, b) => b.net - a.net);
    else if (sort === "controversial") list = [...list].sort((a, b) => Math.min(b.for_count, b.against_count) - Math.min(a.for_count, a.against_count));
    else if (sort === "decision") {
      list = [...list].sort((a, b) => {
        const aDecided = isDecided(a) ? 1 : 0;
        const bDecided = isDecided(b) ? 1 : 0;
        if (aDecided !== bDecided) return aDecided - bDecided;
        return gapTo(a) - gapTo(b);
      });
    }
    else list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [items, myVotes, sort, filter, user, passedById, rejectedById, totalVoters]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Vote" />
        <div className="px-5 py-4 flex flex-col gap-4">
          <SkeletonCard rows={3} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Vote" />
      <div className="px-5 py-4 flex flex-col gap-4">
        <Card>
          <form onSubmit={propose} className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Propose a rule, challenge, or idea…"
              maxLength={140}
              className="flex-1 border border-line rounded-card px-3 py-2 bg-surface focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!text.trim() || posting}
              className="rounded-card bg-accent text-white px-4 py-2 font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </Card>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1 overflow-x-auto -mx-5 px-5 pb-1">
            {(
              [
                ["newest", "Newest"],
                ["popular", "Popular"],
                ["controversial", "Controversial"],
                ["decision", "Closest"],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition ${
                  sort === k ? "bg-accent text-white" : "bg-surface text-muted border border-line"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto -mx-5 px-5 pb-1">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["passed", "Passed"],
                ["rejected", "Rejected"],
                ["unvoted", "Not voted"],
              ] as [FilterKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition ${
                  filter === k ? "bg-ink text-white" : "bg-surface text-muted border border-line"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <li className="text-sm text-muted text-center py-8">
              {filter !== "all" ? "Nothing matches this filter." : "No proposals yet. Be the first."}
            </li>
          )}
          {filtered.map((v) => (
              <VoteCard
                key={v.id}
                item={v}
                myVote={myVotes[v.id]}
                onVote={castVote}
                totalVoters={totalVoters}
                passed={passedById.get(v.id) ?? false}
                rejected={rejectedById.get(v.id) ?? false}
                hasActiveRepeal={activeRepealByOriginalId.has(v.id)}
                originalText={repealsByOriginalId.get(v.id) ?? null}
                onProposeRepeal={proposeRepeal}
              />
            ))}
        </ul>
      </div>
    </main>
  );
}
