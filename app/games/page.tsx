"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import BigButton from "@/components/BigButton";
import Chip from "@/components/Chip";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { SkeletonCard } from "@/components/Skeleton";
import type { GameRow, GameTotalsRow, UserRow } from "@/lib/supabase/types";

type GameSummary = GameRow & { totals: GameTotalsRow[] };

const GameCard = memo(function GameCard({ game }: { game: GameSummary }) {
  const top = [...game.totals].sort((a, b) => b.total_score - a.total_score)[0];
  return (
    <li>
      <Link
        href={`/games/${game.id}`}
        className={`block border border-line rounded-card shadow-card p-4 ${
          game.finished ? "bg-muted/10" : "bg-surface"
        }`}
      >
        <div className="flex justify-between items-baseline">
          <span className={`font-semibold ${game.finished ? "line-through text-muted" : ""}`}>{game.name}</span>
          <span className="text-xs text-muted">{game.totals.length} player{game.totals.length === 1 ? "" : "s"}</span>
        </div>
        {game.finished ? (
          top ? (
            <div className="text-sm mt-1">
              <span className="text-xs text-accent font-medium">✓ Finished</span>
              <span className="text-muted"> — Winner: </span>
              <span className="text-ink font-medium">
                {top.is_buck && "👑 "}{top.user_name}
              </span>
              <span className="text-muted"> · {Number(top.total_score)}</span>
            </div>
          ) : (
            <div className="text-xs text-accent mt-1 font-medium">✓ Finished</div>
          )
        ) : top ? (
          <div className="text-sm text-muted mt-1">
            Leading: <span className="text-ink font-medium">{top.is_buck ? "👑 " : ""}{top.user_name}</span> · {Number(top.total_score)}
          </div>
        ) : null}
      </Link>
    </li>
  );
});

export default function GamesPage() {
  const { user, loading } = useUser();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function load() {
    const s = supabase();
    const [{ data: g }, { data: t }, { data: u }] = await Promise.all([
      s.from("games").select("*").order("created_at", { ascending: false }),
      s.from("v_game_totals").select("*"),
      s.from("users").select("*").order("created_at", { ascending: true }),
    ]);
    const totals = (t ?? []) as GameTotalsRow[];
    setGames(
      ((g ?? []) as GameRow[]).map((game) => ({
        ...game,
        totals: totals.filter((row) => row.game_id === game.id),
      })),
    );
    setMembers((u ?? []) as UserRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel("games")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading]);

  function togglePick(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim() || picked.size === 0) return;
    const s = supabase();
    const { data, error } = await s
      .from("games")
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error || !data) {
      alert(error?.message ?? "Failed to create game");
      return;
    }
    const rows = Array.from(picked).map((uid) => ({ game_id: data.id, user_id: uid }));
    await s.from("game_players").insert(rows);
    setName("");
    setPicked(new Set());
    setCreating(false);
  }

  if (loading || !user) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Games" />
        <div className="px-5 py-4 flex flex-col gap-4">
          <SkeletonCard rows={3} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Games" />
      <div className="px-5 py-4 flex flex-col gap-4">
        {!creating && (
          <BigButton onClick={() => setCreating(true)} variant="secondary">
            ➕ New game
          </BigButton>
        )}

        {creating && (
          <Card>
            <form onSubmit={createGame} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Game name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Beer pong, darts, pool…"
                  maxLength={40}
                  className="border border-line rounded-card px-3 py-2 bg-surface"
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Players</span>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <Chip key={m.id} active={picked.has(m.id)} onClick={() => togglePick(m.id)}>
                      {m.name}
                    </Chip>
                  ))}
                  {members.length === 0 && (
                    <span className="text-sm text-muted">No party members yet.</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setName("");
                    setPicked(new Set());
                  }}
                  className="flex-1 rounded-card border border-line bg-surface py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || picked.size === 0}
                  className="flex-1 rounded-card bg-accent text-white py-2 font-semibold disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </Card>
        )}

        <ul className="flex flex-col gap-3">
          {games.length === 0 && (
            <li className="text-sm text-muted text-center py-8">
              No games yet. Start one.
            </li>
          )}
          {games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
        </ul>
      </div>
    </main>
  );
}
