"use client";

import { memo, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Avatar from "@/components/Avatar";
import BACBadge from "@/components/BACBadge";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import { supabase } from "@/lib/supabase/browser";
import { estimateBAC } from "@/lib/bac";
import { useUser } from "@/lib/user-context";
import { SkeletonCard } from "@/components/Skeleton";
import clsx from "@/components/clsx";
import type {
  DrinkRow,
  DrinksLeaderboardRow,
  GameTotalsRow,
  UserRow,
} from "@/lib/supabase/types";

type Tab = "drinks" | "bac" | "games" | "overall" | "std";

const StatRow = memo(function StatRow({
  rank, name, avatarUrl, isBuck, value, sub,
}: {
  rank: number; name: string; avatarUrl: string | null;
  isBuck: boolean; value: string; sub?: string;
}) {
  return (
    <li className={`flex items-center gap-3 rounded-lg ${isBuck ? "bg-amber-50/50 -mx-2 px-2 py-1" : ""}`}>
      <span className="w-5 text-muted text-sm tabular-nums">{rank}</span>
      <Avatar name={name} url={avatarUrl} size={32} isBuck={isBuck} />
      <span className="flex-1 font-medium">{name}</span>
      <span className="tabular-nums font-semibold">{value}</span>
      {sub && <span className="text-xs text-muted tabular-nums">{sub}</span>}
    </li>
  );
});

const BACStatRow = memo(function BACStatRow({
  rank, name, avatarUrl, isBuck, bacValue, bacStatus,
}: {
  rank: number; name: string; avatarUrl: string | null;
  isBuck: boolean; bacValue: number; bacStatus: string;
}) {
  const result = bacStatus === "ok"
    ? ({ status: "ok" as const, value: bacValue })
    : ({ status: "missing_profile" as const });
  return (
    <li className={`flex items-center gap-3 rounded-lg ${isBuck ? "bg-amber-50/50 -mx-2 px-2 py-1" : ""}`}>
      <span className="w-5 text-muted text-sm tabular-nums">{rank}</span>
      <Avatar name={name} url={avatarUrl} size={32} isBuck={isBuck} />
      <span className="flex-1 font-medium">{name}</span>
      <BACBadge result={result} />
    </li>
  );
});

export default function LeaderboardsPage() {
  const { user, loading } = useUser();
  const [tab, setTab] = useState<Tab>("drinks");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drinks, setDrinks] = useState<DrinkRow[]>([]);
  const [drinkBoard, setDrinkBoard] = useState<DrinksLeaderboardRow[]>([]);
  const [gameTotals, setGameTotals] = useState<GameTotalsRow[]>([]);

  async function load() {
    const s = supabase();
    const [{ data: u }, { data: d }, { data: b }, { data: g }] = await Promise.all([
      s.from("users").select("*"),
      s.from("drink_entries").select("*"),
      s.from("v_drinks_leaderboard").select("*"),
      s.from("v_game_totals").select("*"),
    ]);
    setUsers((u ?? []) as UserRow[]);
    setDrinks((d ?? []) as DrinkRow[]);
    setDrinkBoard((b ?? []) as DrinksLeaderboardRow[]);
    setGameTotals((g ?? []) as GameTotalsRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel("leaderboards")
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading]);

  const bacRows = useMemo(() => {
    return users
      .map((u) => {
        const userDrinks = drinks.filter((d) => d.user_id === u.id);
        const bac = estimateBAC(u, userDrinks);
        return {
          user: u,
          bac,
          value: bac.status === "ok" ? bac.value : -1,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [users, drinks]);

  const gameRows = useMemo(() => {
    const byUser = new Map<string, { user_id: string; name: string; avatar_url: string | null; is_buck: boolean; total: number; wins: number }>();
    for (const u of users) {
      byUser.set(u.id, { user_id: u.id, name: u.name, avatar_url: u.avatar_url, is_buck: u.is_buck, total: 0, wins: 0 });
    }
    for (const t of gameTotals) {
      const row = byUser.get(t.user_id);
      if (row) row.total += Number(t.total_score);
    }
    // Count wins per game = top total_score within that game.
    const byGame = new Map<string, GameTotalsRow[]>();
    for (const t of gameTotals) {
      const list = byGame.get(t.game_id) ?? [];
      list.push(t);
      byGame.set(t.game_id, list);
    }
    for (const list of byGame.values()) {
      const top = [...list].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
      if (top && Number(top.total_score) > 0) {
        const row = byUser.get(top.user_id);
        if (row) row.wins += 1;
      }
    }
    return [...byUser.values()].sort((a, b) => b.wins - a.wins || b.total - a.total);
  }, [users, gameTotals]);

  const overallRows = useMemo(() => {
    // Combined: normalized rank across drinks count + game wins (lower rank = better).
    const ids = users.map((u) => u.id);
    const drinkOrder = [...drinkBoard].sort((a, b) => b.drink_count - a.drink_count);
    const drinkRankOf = new Map<string, number>();
    drinkOrder.forEach((r, i) => drinkRankOf.set(r.id, i));
    const gameRankOf = new Map<string, number>();
    gameRows.forEach((r, i) => gameRankOf.set(r.user_id, i));
    return users
      .map((u) => {
        const dRank = drinkRankOf.get(u.id) ?? ids.length;
        const gRank = gameRankOf.get(u.id) ?? ids.length;
        return { user: u, combined: dRank + gRank };
      })
      .sort((a, b) => a.combined - b.combined);
  }, [users, drinkBoard, gameRows]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Leaderboards" />
        <div className="px-5 pb-4 flex flex-col gap-3 flex-1">
          <SkeletonCard rows={5} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Leaderboards" />
      <div className="px-5 py-2 flex gap-2 overflow-x-auto">
        {(["drinks", "std", "bac", "games", "overall"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm capitalize whitespace-nowrap",
              tab === t
                ? "bg-accent text-white border-accent"
                : "bg-surface text-ink border-line",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="px-5 pb-4 flex flex-col gap-3 flex-1">
        <Card>
          {      tab === "drinks" && (
            <ul className="flex flex-col gap-3">
              {drinkBoard
                .slice()
                .sort((a, b) => b.drink_count - a.drink_count)
                .map((r, i) => (
                  <StatRow
                    key={r.id}
                    rank={i + 1}
                    name={r.name}
                    avatarUrl={r.avatar_url}
                    isBuck={r.is_buck}
                    value={String(r.drink_count)}
                    sub={`${Number(r.standard_drinks).toFixed(1)} std`}
                  />
                ))}
              {drinkBoard.length === 0 && (
                <li className="text-sm text-muted text-center">No data.</li>
              )}
            </ul>
          )}

          {tab === "std" && (
            <ul className="flex flex-col gap-3">
              {drinkBoard
                .slice()
                .sort((a, b) => Number(b.standard_drinks) - Number(a.standard_drinks))
                .map((r, i) => (
                  <StatRow
                    key={r.id}
                    rank={i + 1}
                    name={r.name}
                    avatarUrl={r.avatar_url}
                    isBuck={r.is_buck}
                    value={Number(r.standard_drinks).toFixed(1)}
                    sub={`${r.drink_count} drinks`}
                  />
                ))}
              {drinkBoard.length === 0 && (
                <li className="text-sm text-muted text-center">No data.</li>
              )}
            </ul>
          )}

          {tab === "bac" && (
            <ul className="flex flex-col gap-3">
              {bacRows.map((row, i) => (
                  <BACStatRow
                    key={row.user.id}
                    rank={i + 1}
                    name={row.user.name}
                    avatarUrl={row.user.avatar_url}
                    isBuck={row.user.is_buck}
                    bacValue={row.bac.status === "ok" ? row.bac.value : -1}
                    bacStatus={row.bac.status}
                  />
                ))}
              {bacRows.length === 0 && (
                <li className="text-sm text-muted text-center">No data.</li>
              )}
            </ul>
          )}

          {tab === "games" && (
            <ul className="flex flex-col gap-3">
              {gameRows.map((r, i) => (
                  <StatRow
                    key={r.user_id}
                    rank={i + 1}
                    name={r.name}
                    avatarUrl={r.avatar_url}
                    isBuck={r.is_buck}
                    value={`${r.wins} W`}
                    sub={`${r.total} pts`}
                  />
                ))}
              {gameRows.length === 0 && (
                <li className="text-sm text-muted text-center">No data.</li>
              )}
            </ul>
          )}

          {tab === "overall" && (
            <ul className="flex flex-col gap-3">
              {overallRows.map((r, i) => (
                  <StatRow
                    key={r.user.id}
                    rank={i + 1}
                    name={r.user.name}
                    avatarUrl={r.user.avatar_url}
                    isBuck={r.user.is_buck}
                    value="drinks + game wins"
                  />
                ))}
              {overallRows.length === 0 && (
                <li className="text-sm text-muted text-center">No data.</li>
              )}
            </ul>
          )}
        </Card>
      </div>
      <DisclaimerFooter />
    </main>
  );
}
