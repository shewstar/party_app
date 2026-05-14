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
import type { GameRow, GamePlayerRow, GameTotalsRow, UserRow } from "@/lib/supabase/types";
import FinskaBoard from "@/components/FinskaBoard";
import CornholeBoard from "@/components/CornholeBoard";
import { FINSKA, shuffle } from "@/lib/finska";
import { CORNHOLE } from "@/lib/cornhole";
import { getShuffledColors } from "@/lib/team-colors";
import clsx from "@/components/clsx";
import { burstPB } from "@/lib/confetti";

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
  const { data: allGamePlayers } = useTableData<GamePlayerRow>("game_players");

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

  // Fire confetti when the current user sets a personal best in this game —
  // i.e. their total in this game crosses their previous all-time-best total
  // across every game they've played. Seed the ref on first render so we
  // don't celebrate already-known totals.
  const pbRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    const allTotals = allTotalsRaw as GameTotalsRow[];
    const myBest = allTotals
      .filter((t) => t.user_id === user.id)
      .reduce((max, t) => Math.max(max, Number(t.total_score)), 0);
    if (pbRef.current === null) {
      pbRef.current = myBest;
      return;
    }
    // Only celebrate a meaningful PB (>= 5 points) to avoid firing on first-point
    // games where any score is technically the new best.
    if (myBest > pbRef.current && myBest >= 5) {
      const currentInThisGame = allTotals.find(
        (t) => t.user_id === user.id && t.game_id === id,
      );
      if (currentInThisGame && Number(currentInThisGame.total_score) === myBest) {
        burstPB();
      }
    }
    pbRef.current = Math.max(pbRef.current, myBest);
  }, [allTotalsRaw, user, id]);

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

  const gamePlayers = useMemo(
    () => (allGamePlayers as GamePlayerRow[]).filter((p) => p.game_id === id),
    [allGamePlayers, id],
  );

  const teamByUserId = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const gp of gamePlayers) m.set(gp.user_id, gp.team_index);
    return m;
  }, [gamePlayers]);

  const teamTotals = useMemo(() => {
    if (!game?.team_count) return null;
    const t: number[] = new Array(game.team_count).fill(0);
    for (const row of totals) {
      const ti = teamByUserId.get(row.user_id);
      if (ti != null && ti >= 0 && ti < game.team_count) {
        t[ti] += Number(row.total_score);
      }
    }
    return t;
  }, [game?.team_count, totals, teamByUserId]);

  const shuffledColors = useMemo(
    () => (game ? getShuffledColors(game.id) : []),
    [game],
  );

  function getTc(index: number | null | undefined) {
    if (index == null || shuffledColors.length === 0) return null;
    return shuffledColors[index % shuffledColors.length];
  }

  const sorted = useMemo(() => {
    const base = [...totals].sort((a, b) => Number(b.total_score) - Number(a.total_score));

    if (game?.team_count) {
      const grouped: { teamIndex: number; rows: GameTotalsRow[] }[] = [];
      for (let i = 0; i < game.team_count; i++) {
        grouped.push({ teamIndex: i, rows: [] });
      }
      const unassigned: GameTotalsRow[] = [];
      for (const row of base) {
        const ti = teamByUserId.get(row.user_id);
        if (ti != null && ti >= 0 && ti < game.team_count) {
          grouped[ti].rows.push(row);
        } else {
          unassigned.push(row);
        }
      }
      for (const g of grouped) {
        g.rows.sort((a, b) => Number(b.total_score) - Number(a.total_score));
      }
      return grouped.flatMap((g) => g.rows).concat(unassigned);
    }

    if (frozenOrder) {
      return [
        ...frozenOrder
          .map((uid) => base.find((t) => t.user_id === uid))
          .filter((r): r is GameTotalsRow => !!r),
        ...base.filter((t) => !frozenOrder.includes(t.user_id)),
      ];
    }
    return base;
  }, [totals, game?.team_count, teamByUserId, frozenOrder]);

  async function setPlayerTeam(userId: string, teamIndex: number | null) {
    if (!game) return;
    await supabase()
      .from("game_players")
      .update({ team_index: teamIndex })
      .eq("game_id", game.id)
      .eq("user_id", userId);
    await refreshTable("game_players");
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
    } else if (game.preset === CORNHOLE.id) {
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

  if (game.preset === CORNHOLE.id) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title={game.name} />
        <div className="px-5 pt-4 flex justify-between items-center">
          {finished ? (
            <span className="text-sm text-accent font-medium">✓ Finished</span>
          ) : (
            <span className="text-xs text-muted">Cornhole · first to 21</span>
          )}
          <button
            type="button"
            onClick={() => toggleFinished()}
            className={`text-sm underline ${finished ? "text-muted" : "text-accent"}`}
          >
            {finished ? "Unfinish" : "Finish game"}
          </button>
        </div>
        <CornholeBoard
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

        {/* Team score bar */}
        {teamTotals && (
          <div className="flex gap-2">
            {teamTotals.map((score, i) => {
              const tc = getTc(i);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-card px-3 py-2 text-center text-white"
                  style={{ backgroundColor: tc?.hex ?? "#888" }}
                >
                  <div className="text-xs font-medium opacity-90">{tc?.name ?? `Team ${i + 1}`}</div>
                  <div className="text-lg font-bold tabular-nums">{score}</div>
                </div>
              );
            })}
          </div>
        )}

        {sorted.length === 0 && (
          <Card>
            <p className="text-sm text-muted text-center">No players selected for this game.</p>
          </Card>
        )}

        {sorted.map((row, i) => {
          const ti = game?.team_count ? teamByUserId.get(row.user_id) : undefined;
          const prevRow = i > 0 ? sorted[i - 1] : null;
          const prevTi = prevRow && game?.team_count ? teamByUserId.get(prevRow.user_id) : undefined;
          const isNewTeam = ti != null && ti !== prevTi;
          const tc = getTc(ti);

          return (
            <div key={row.user_id}>
              {isNewTeam && tc && (
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: tc.hex }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: tc.hex }}
                  >
                    {tc.name} Team
                  </span>
                </div>
              )}
              <Card
                className={clsx(
                  row.is_buck && "ring-2 ring-amber-400",
                )}
                style={tc ? {
                  borderLeft: `4px solid ${tc.hex}`,
                } : undefined}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={row.user_name} url={row.avatar_url} size={36} isBuck={row.is_buck} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{row.user_name}</div>
                    <div className="text-xs text-muted tabular-nums">
                      {Number(row.total_score)} pts
                    </div>
                  </div>
                  {game.team_count && !finished && (
                    <select
                      value={ti ?? ""}
                      onChange={(e) =>
                        setPlayerTeam(row.user_id, e.target.value ? Number(e.target.value) : null)
                      }
                      className="text-xs border border-line rounded-md px-1.5 py-1 bg-surface mr-1 max-w-[80px] truncate"
                    >
                      <option value="">—</option>
                      {Array.from({ length: game.team_count }, (_, idx) => (
                        <option key={idx} value={idx}>
                          {getTc(idx)?.name ?? `Team ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}
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
            </div>
          );
        })}
      </div>
    </main>
  );
}
