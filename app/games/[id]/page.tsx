"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Avatar from "@/components/Avatar";
import BigButton from "@/components/BigButton";
import Chip from "@/components/Chip";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { useHaptic } from "@/lib/haptics";
import { useOnlineStatus } from "@/lib/offline-queue";
import { useTableData, useRealtimeReady, useRefreshTable } from "@/lib/realtime-provider";
import type { GameRow, GameTotalsRow, UserRow } from "@/lib/supabase/types";
import FinskaBoard from "@/components/FinskaBoard";
import { FINSKA, shuffle } from "@/lib/finska";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useUser();
  const haptic = useHaptic();
  const { online, enqueue } = useOnlineStatus();
  const ready = useRealtimeReady();
  const refreshTable = useRefreshTable();
  const { data: allGames } = useTableData<GameRow>("games");
  const { data: allTotalsRaw } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: allUsers } = useTableData<UserRow>("users");

  const game = useMemo(
    () => (allGames as GameRow[]).find((g) => g.id === id) ?? null,
    [allGames, id],
  );
  // Optimistic score deltas keyed by user_id — applied on top of provider
  // totals so taps feel instant. Each delta is cleared once the v_game_totals
  // refetch confirms the server total reflects that insert, avoiding the
  // double-count window where (server + optimistic) briefly equals 2× the tap.
  const [optimisticDeltas, setOptimisticDeltas] = useState<Record<string, number>>({});
  // Optimistic finished flag for snappy toggle feedback.
  const [optimisticFinished, setOptimisticFinished] = useState<boolean | null>(null);
  const totals = useMemo(() => {
    const base = (allTotalsRaw as GameTotalsRow[]).filter((t) => t.game_id === id);
    if (Object.keys(optimisticDeltas).length === 0) return base;
    return base.map((t) => ({
      ...t,
      total_score: Number(t.total_score) + (optimisticDeltas[t.user_id] ?? 0),
    }));
  }, [allTotalsRaw, id, optimisticDeltas]);

  const [busy, setBusy] = useState<string | null>(null);
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const frozenOrderRef = useRef<string[] | null>(null);
  frozenOrderRef.current = frozenOrder;
  const resortTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (resortTimer.current) clearTimeout(resortTimer.current);
    };
  }, []);

  async function bump(userId: string, delta: number) {
    if (!game) return;
    haptic.light();
    setFrozenOrder((prev) => {
      if (prev) return prev;
      return [...totals]
        .sort((a, b) => Number(b.total_score) - Number(a.total_score))
        .map((t) => t.user_id);
    });
    if (resortTimer.current) clearTimeout(resortTimer.current);
    resortTimer.current = setTimeout(() => setFrozenOrder(null), 1500);

    setBusy(`${userId}:${delta}`);
    setOptimisticDeltas((prev) => ({ ...prev, [userId]: (prev[userId] ?? 0) + delta }));

    const payload = { game_id: game.id, user_id: userId, score: delta };
    if (!online) {
      enqueue("game_scores", payload);
    } else {
      await supabase().from("game_scores").insert(payload);
      await refreshTable("v_game_totals");
      flushSync(() => {
        setOptimisticDeltas((prev) => {
          const next = { ...prev };
          const remaining = (next[userId] ?? 0) - delta;
          if (remaining === 0) delete next[userId];
          else next[userId] = remaining;
          return next;
        });
      });
    }
    setBusy(null);
  }

  const members = allUsers as UserRow[];

  async function openAddPlayers() {
    setPicked(new Set());
    setShowAddPlayers(!showAddPlayers);
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function addPlayers(e: React.FormEvent) {
    e.preventDefault();
    if (!game || picked.size === 0) return;
    const s = supabase();
    let rows: { game_id: string; user_id: string; throw_order: number | null }[];
    if (game.preset === FINSKA.id) {
      // New Finska entrants append to the rotation after the current max
      // throw_order, in random order among themselves.
      const { data: existing } = await s
        .from("game_players")
        .select("throw_order")
        .eq("game_id", game.id);
      const maxOrder = (existing ?? []).reduce(
        (m, p) => Math.max(m, p.throw_order ?? -1),
        -1,
      );
      const order = shuffle(Array.from(picked));
      rows = order.map((uid, i) => ({
        game_id: game.id,
        user_id: uid,
        throw_order: maxOrder + 1 + i,
      }));
    } else {
      rows = Array.from(picked).map((uid) => ({
        game_id: game.id,
        user_id: uid,
        throw_order: null,
      }));
    }
    await s.from("game_players").insert(rows);
    setPicked(new Set());
    setShowAddPlayers(false);
  }

  async function toggleFinished(target?: boolean) {
    if (!game) return;
    const next = target ?? !finished;
    if (next === finished) return;
    setOptimisticFinished(next);
    await supabase().from("games").update({ finished: next }).eq("id", game.id);
    // Clear after realtime should have refreshed the games table.
    setTimeout(() => setOptimisticFinished(null), 1500);
  }

  if (loading || !user || !ready) {
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
  const finished = optimisticFinished ?? game.finished;

  const existingIds = new Set(totals.map((t) => t.user_id));
  const available = members.filter((m) => !existingIds.has(m.id));

  if (game.preset === FINSKA.id) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title={game.name} />
        <div className="px-5 pt-4 flex justify-between items-center">
          {finished ? (
            <span className="text-sm text-accent font-medium">✓ Finished</span>
          ) : (
            <span className="text-xs text-muted">Finska · first to 50</span>
          )}
          <button
            type="button"
            onClick={() => toggleFinished()}
            className={`text-sm underline ${finished ? "text-muted" : "text-accent"}`}
          >
            {finished ? "Unfinish" : "Finish game"}
          </button>
        </div>
        <FinskaBoard
          game={game}
          finished={finished}
          onAutoFinish={() => toggleFinished(true)}
        />
        {!finished && (
          <div className="px-5 pb-6 flex flex-col gap-3">
            {!showAddPlayers && (
              <button
                type="button"
                onClick={openAddPlayers}
                className="self-center text-sm text-accent underline"
              >
                ➕ Add players
              </button>
            )}
            {showAddPlayers && (
              <Card>
                <form onSubmit={addPlayers} className="flex flex-col gap-3">
                  <span className="text-sm font-medium">Add players to {game.name}</span>
                  <p className="text-xs text-muted">
                    New players join the end of the throw rotation and start at 0.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {available.map((m) => (
                      <Chip
                        key={m.id}
                        active={picked.has(m.id)}
                        onClick={() => togglePick(m.id)}
                      >
                        {m.name}
                      </Chip>
                    ))}
                    {available.length === 0 && (
                      <span className="text-sm text-muted">
                        Everyone's already playing.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openAddPlayers}
                      className="flex-1 rounded-card border border-line bg-surface py-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={picked.size === 0}
                      className="flex-1 rounded-card bg-accent text-white py-2 font-semibold disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        )}
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
        {finished && (
          <div className="text-sm text-accent font-medium text-center">✓ This game is finished</div>
        )}

        <button
          type="button"
          onClick={() => toggleFinished()}
          className={`text-sm underline self-end ${finished ? "text-muted" : "text-accent"}`}
        >
          {finished ? "Unfinish" : "Finish game"}
        </button>

        {!finished && (
          <BigButton onClick={openAddPlayers} variant="secondary">
            ➕ Add players
          </BigButton>
        )}

        {showAddPlayers && (
          <Card>
            <form onSubmit={addPlayers} className="flex flex-col gap-3">
              <span className="text-sm font-medium">Add players to {game.name}</span>
              <div className="flex flex-wrap gap-2">
                {available.map((m) => (
                  <Chip key={m.id} active={picked.has(m.id)} onClick={() => togglePick(m.id)}>
                    {m.name}
                  </Chip>
                ))}
                {available.length === 0 && (
                  <span className="text-sm text-muted">Everyone's already playing.</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openAddPlayers}
                  className="flex-1 rounded-card border border-line bg-surface py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={picked.size === 0}
                  className="flex-1 rounded-card bg-accent text-white py-2 font-semibold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>
          </Card>
        )}

        {sorted.length === 0 && (
          <Card>
            <p className="text-sm text-muted text-center">No players selected for this game.</p>
          </Card>
        )}
        {sorted.map((row, i) => (
          <Card key={row.user_id} className={row.is_buck ? "ring-2 ring-amber-400" : ""}>
            <div className="flex items-center gap-3">
              <span className="w-5 text-muted text-sm tabular-nums">{i + 1}</span>
              <Avatar name={row.user_name} url={row.avatar_url} size={36} isBuck={row.is_buck} />
              <div className="flex-1">
                <div className="font-medium">{row.user_name}</div>
                <div className="text-xs text-muted tabular-nums">
                  {Number(row.total_score)} pts
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy !== null || finished}
                  onClick={() => bump(row.user_id, -1)}
                  className="rounded-full border border-line bg-surface w-11 h-11 text-xl font-bold disabled:opacity-30"
                  aria-label="Subtract point"
                >
                  −
                </button>
                <button
                  disabled={busy !== null || finished}
                  onClick={() => bump(row.user_id, 1)}
                  className="rounded-full bg-accent text-white w-11 h-11 text-xl font-bold disabled:opacity-30"
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
