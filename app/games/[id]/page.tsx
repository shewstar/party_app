"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import type { GameRow, GameTotalsRow } from "@/lib/supabase/types";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useUser();
  const [game, setGame] = useState<GameRow | null>(null);
  const [totals, setTotals] = useState<GameTotalsRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const resortTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resortTimer.current) clearTimeout(resortTimer.current);
    };
  }, []);

  async function load() {
    if (!id) return;
    const s = supabase();
    const [{ data: g }, { data: t }] = await Promise.all([
      s.from("games").select("*").eq("id", id).maybeSingle(),
      s.from("v_game_totals").select("*").eq("game_id", id),
    ]);
    setGame((g as GameRow) ?? null);
    setTotals((t ?? []) as GameTotalsRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel(`game:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_scores", filter: `game_id=eq.${id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${id}` },
        load,
      )
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading, id]);

  async function bump(userId: string, delta: number) {
    if (!game) return;
    setFrozenOrder((prev) => {
      if (prev) return prev;
      return [...totals]
        .sort((a, b) => Number(b.total_score) - Number(a.total_score))
        .map((t) => t.user_id);
    });
    if (resortTimer.current) clearTimeout(resortTimer.current);
    resortTimer.current = setTimeout(() => setFrozenOrder(null), 1500);

    setBusy(`${userId}:${delta}`);
    // Optimistic.
    setTotals((arr) =>
      arr.map((r) =>
        r.user_id === userId
          ? { ...r, total_score: Number(r.total_score) + delta }
          : r,
      ),
    );
    await supabase().from("game_scores").insert({
      game_id: game.id,
      user_id: userId,
      score: delta,
    });
    setBusy(null);
  }

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }
  if (!game) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Game" />
        <div className="px-5 py-8 text-center text-muted">Game not found.</div>
      </main>
    );
  }

  const sorted = frozenOrder
    ? [
        ...frozenOrder
          .map((id) => totals.find((t) => t.user_id === id))
          .filter((r): r is GameTotalsRow => !!r),
        ...totals.filter((t) => !frozenOrder.includes(t.user_id)),
      ]
    : [...totals].sort((a, b) => Number(b.total_score) - Number(a.total_score));

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title={game.name} />
      <div className="px-5 py-4 flex flex-col gap-3">
        {sorted.length === 0 && (
          <Card>
            <p className="text-sm text-muted text-center">No players selected for this game.</p>
          </Card>
        )}
        {sorted.map((row, i) => (
          <Card key={row.user_id}>
            <div className="flex items-center gap-3">
              <span className="w-5 text-muted text-sm tabular-nums">{i + 1}</span>
              <Avatar name={row.user_name} url={row.avatar_url} size={36} />
              <div className="flex-1">
                <div className="font-medium">{row.user_name}</div>
                <div className="text-xs text-muted tabular-nums">
                  {Number(row.total_score)} pts
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => bump(row.user_id, -1)}
                  className="rounded-full border border-line bg-surface w-11 h-11 text-xl font-bold"
                  aria-label="Subtract point"
                >
                  −
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => bump(row.user_id, 1)}
                  className="rounded-full bg-accent text-white w-11 h-11 text-xl font-bold"
                  aria-label="Add point"
                >
                  +
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
