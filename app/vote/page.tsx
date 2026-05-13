"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import type { VoteResponseRow, VoteTallyRow } from "@/lib/supabase/types";
import clsx from "@/components/clsx";

export default function VotePage() {
  const { user, loading } = useUser();
  const [items, setItems] = useState<VoteTallyRow[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  type SortKey = "newest" | "popular" | "controversial";
  type FilterKey = "all" | "voted" | "unvoted" | "mine";
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<FilterKey>("all");

  async function load() {
    if (!user) return;
    const s = supabase();
    const [{ data: tally }, { data: mine }] = await Promise.all([
      s.from("v_vote_tally").select("*").order("created_at", { ascending: false }),
      s.from("vote_responses").select("*").eq("user_id", user.id),
    ]);
    setItems((tally ?? []) as VoteTallyRow[]);
    const map: Record<string, 1 | -1> = {};
    for (const r of (mine ?? []) as VoteResponseRow[]) map[r.vote_item_id] = r.value;
    setMyVotes(map);
  }

  useEffect(() => {
    if (loading || !user) return;
    load();
    const s = supabase();
    const ch = s
      .channel("vote")
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading, user]);

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

  async function castVote(item: VoteTallyRow, value: 1 | -1) {
    if (!user) return;
    const previous = myVotes[item.id];
    if (previous === value) {
      // Toggle off — delete the response.
      setMyVotes((m) => {
        const { [item.id]: _drop, ...rest } = m;
        return rest;
      });
      // Optimistic tally update.
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
      return;
    }
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
  }

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "voted") list = list.filter((v) => myVotes[v.id] !== undefined);
    if (filter === "unvoted") list = list.filter((v) => myVotes[v.id] === undefined);
    if (filter === "mine") list = list.filter((v) => v.proposer_id === user?.id);
    if (sort === "popular") list = [...list].sort((a, b) => b.net - a.net);
    else if (sort === "controversial") list = [...list].sort((a, b) => Math.min(b.for_count, b.against_count) - Math.min(a.for_count, a.against_count));
    else list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [items, myVotes, sort, filter, user]);

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
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
          <div className="flex gap-1">
            {(["newest", "popular", "controversial"] as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                  sort === k ? "bg-accent text-white" : "bg-surface text-muted border border-line"
                }`}
              >
                {k === "newest" ? "Newest" : k === "popular" ? "Popular" : "Controversial"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["all", "voted", "unvoted", "mine"] as FilterKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                  filter === k ? "bg-ink text-white" : "bg-surface text-muted border border-line"
                }`}
              >
                {k === "all" ? "All" : k === "voted" ? "Voted" : k === "unvoted" ? "Not voted" : "Mine"}
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
          {filtered.map((v) => {
            const mine = myVotes[v.id];
            return (
              <li
                key={v.id}
                className="bg-surface border border-line rounded-card shadow-card p-4 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <span className="flex-1">{v.text}</span>
                  <span
                    className={clsx(
                      "tabular-nums font-semibold text-sm",
                      v.net > 0 && "text-accent",
                      v.net < 0 && "text-danger",
                      v.net === 0 && "text-muted",
                    )}
                  >
                    {v.net > 0 ? `+${v.net}` : v.net}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => castVote(v, 1)}
                    className={clsx(
                      "flex-1 rounded-card border px-3 py-2 font-medium",
                      mine === 1
                        ? "bg-accent text-white border-accent"
                        : "bg-surface text-ink border-line",
                    )}
                  >
                    👍 For · {v.for_count}
                  </button>
                  <button
                    onClick={() => castVote(v, -1)}
                    className={clsx(
                      "flex-1 rounded-card border px-3 py-2 font-medium",
                      mine === -1
                        ? "bg-danger text-white border-danger"
                        : "bg-surface text-ink border-line",
                    )}
                  >
                    👎 Against · {v.against_count}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
