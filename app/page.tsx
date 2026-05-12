"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BigButton from "@/components/BigButton";
import Card from "@/components/Card";
import Tile from "@/components/Tile";
import Avatar from "@/components/Avatar";
import BACBadge from "@/components/BACBadge";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import { supabase } from "@/lib/supabase/browser";
import { estimateBAC } from "@/lib/bac";
import { useUser } from "@/lib/user-context";
import type { DrinkRow, DrinksLeaderboardRow, VoteTallyRow } from "@/lib/supabase/types";

export default function HomePage() {
  const { user, loading } = useUser();
  const [myDrinks, setMyDrinks] = useState<DrinkRow[]>([]);
  const [board, setBoard] = useState<DrinksLeaderboardRow[]>([]);
  const [forItems, setForItems] = useState<VoteTallyRow[]>([]);
  const [newVoteCount, setNewVoteCount] = useState(0);

  async function loadAll(uid?: string) {
    const s = supabase();
    const [
      { data: drinks },
      { data: lb },
      { data: tally },
      { data: voteIds },
      { data: myResponses },
    ] = await Promise.all([
      uid
        ? s.from("drink_entries").select("*").eq("user_id", uid).order("logged_at", { ascending: false })
        : Promise.resolve({ data: [] as DrinkRow[] }),
      s.from("v_drinks_leaderboard").select("*").order("drink_count", { ascending: false }).limit(5),
      s.from("v_vote_tally").select("*").gt("net", 0).order("net", { ascending: false }),
      s.from("vote_items").select("id"),
      uid
        ? s.from("vote_responses").select("vote_item_id").eq("user_id", uid)
        : Promise.resolve({ data: [] as { vote_item_id: string }[] }),
    ]);
    setMyDrinks((drinks ?? []) as DrinkRow[]);
    setBoard((lb ?? []) as DrinksLeaderboardRow[]);
    setForItems((tally ?? []) as VoteTallyRow[]);
    const voted = new Set(
      ((myResponses ?? []) as { vote_item_id: string }[]).map((r) => r.vote_item_id),
    );
    const unvoted = ((voteIds ?? []) as { id: string }[]).filter((v) => !voted.has(v.id)).length;
    setNewVoteCount(unvoted);
  }

  useEffect(() => {
    if (loading) return;
    loadAll(user?.id);
    const s = supabase();
    const ch = s
      .channel("home")
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_entries" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_items" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () =>
        loadAll(user?.id),
      )
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading, user?.id]);

  const bac = useMemo(
    () => (user ? estimateBAC(user, myDrinks) : { status: "missing_profile" as const }),
    [user, myDrinks],
  );

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  return (
    <main className="flex-1 px-5 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} url={user.avatar_url} size={44} />
          <div>
            <div className="text-sm text-muted">Hey</div>
            <div className="text-lg font-semibold">{user.name}</div>
          </div>
        </div>
        <Link href="/settings" className="text-sm text-muted underline">
          Settings
        </Link>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Drinks</div>
            <div className="text-3xl font-bold tabular-nums">{myDrinks.length}</div>
            <div className="text-xs text-muted">
              {myDrinks
                .reduce((s, d) => s + Number(d.standard_drinks), 0)
                .toFixed(1)}{" "}
              std
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Est. BAC</div>
            <BACBadge result={bac} />
          </div>
        </div>
      </Card>

      <BigButton href="/drink" className="py-7 text-2xl">
        ➕ Add a Drink
      </BigButton>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/games" icon="🎯" label="Games" sub="Score it" />
        <Tile href="/leaderboards" icon="🏆" label="Leaderboards" sub="Who's winning" />
        <Tile href="/vote" icon="🗳️" label="Vote" sub="Propose rules" badge={newVoteCount} />
        <Tile href="/settings" icon="⚙️" label="Settings" sub="You & BAC" />
        <Tile href="/recap" icon="🏁" label="Recap" sub="End-of-night stats" className="col-span-2" />
      </div>

      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Drinks leaderboard</h2>
          <Link href="/leaderboards" className="text-sm text-accent">
            View all →
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {board.length === 0 && <li className="text-sm text-muted">No drinks yet.</li>}
          {board.map((row, i) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-5 text-muted text-sm tabular-nums">{i + 1}</span>
              <Avatar name={row.name} url={row.avatar_url} size={32} />
              <span className="flex-1 font-medium">{row.name}</span>
              <span className="tabular-nums font-semibold">{row.drink_count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Voted in</h2>
          <Link href="/vote" className="text-sm text-accent">
            Vote →
          </Link>
        </div>
        {forItems.length === 0 ? (
          <p className="text-sm text-muted">Nothing has been voted in yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {forItems.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 border border-line rounded-card px-3 py-2 bg-surface2"
              >
                <span className="text-sm">{v.text}</span>
                <span className="text-xs text-accent font-semibold tabular-nums">
                  +{v.net}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DisclaimerFooter />
    </main>
  );
}
