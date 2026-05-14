"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase/browser";
import { useHaptic } from "@/lib/haptics";
import { useOnlineStatus } from "@/lib/offline-queue";
import { useRefreshTable, useTableData } from "@/lib/realtime-provider";
import {
  FINSKA,
  PIN_DIAMOND,
  computeFinskaState,
  throwScoreFromPins,
  type FinskaThrowEvent,
} from "@/lib/finska";
import type {
  GamePlayerRow,
  GameRow,
  GameScoreRow,
  UserRow,
} from "@/lib/supabase/types";
import clsx from "@/components/clsx";
import { getShuffledColors } from "@/lib/team-colors";

type Props = {
  game: GameRow;
  finished: boolean;
  onAutoFinish: () => void;
};

export default function FinskaBoard({ game, finished, onAutoFinish }: Props) {
  const haptic = useHaptic();
  const { online, enqueue } = useOnlineStatus();
  const refreshTable = useRefreshTable();
  const { data: allPlayers } = useTableData<GamePlayerRow>("game_players");
  const { data: allScores } = useTableData<GameScoreRow>("game_scores");
  const { data: allUsers } = useTableData<UserRow>("users");

  const players = useMemo(
    () => (allPlayers as GamePlayerRow[]).filter((p) => p.game_id === game.id),
    [allPlayers, game.id],
  );
  const throws = useMemo(
    () => (allScores as GameScoreRow[]).filter((s) => s.game_id === game.id),
    [allScores, game.id],
  );
  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of allUsers as UserRow[]) m.set(u.id, u);
    return m;
  }, [allUsers]);

  const state = useMemo(() => computeFinskaState(players, throws, game.team_count), [players, throws, game.team_count]);

  // Auto-finish the game when Finska rules declare a winner.
  useEffect(() => {
    if (state.winnerId && !finished) onAutoFinish();
  }, [state.winnerId, finished, onAutoFinish]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function togglePin(n: number) {
    if (finished || submitting) return;
    haptic.light();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async function recordScore(score: number) {
    if (!state.currentThrowerId || finished) return;
    setSubmitting(true);
    haptic.medium();
    const payload = {
      game_id: game.id,
      user_id: state.currentThrowerId,
      score,
    };
    if (!online) {
      enqueue("game_scores", payload);
    } else {
      await supabase().from("game_scores").insert(payload);
      await refreshTable("game_scores");
    }
    setSelected(new Set());
    setSubmitting(false);
  }

  async function onConfirm() {
    const pins = [...selected];
    const score = throwScoreFromPins(pins);
    if (score === 0) return;
    await recordScore(score);
  }

  async function onMiss() {
    if (!state.currentThrowerId || finished) return;
    setSelected(new Set());
    await recordScore(0);
  }

  async function assignTeam(userId: string, teamIndex: number | null) {
    await supabase()
      .from("game_players")
      .update({ team_index: teamIndex })
      .eq("game_id", game.id)
      .eq("user_id", userId);
    await refreshTable("game_players");
  }

  const orderedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const at = a.team_index;
      const bt = b.team_index;
      if (at != null && bt != null) {
        if (at !== bt) return at - bt;
      } else if (at != null) return -1;
      else if (bt != null) return 1;
      const ao = a.throw_order;
      const bo = b.throw_order;
      if (ao == null && bo == null) return 0;
      if (ao == null) return 1;
      if (bo == null) return -1;
      return ao - bo;
    });
  }, [players]);

  const teamByUserId = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const p of players) m.set(p.user_id, p.team_index);
    return m;
  }, [players]);

  const hasTeams = game.team_count != null && game.team_count > 0;

  const shuffledColors = useMemo(
    () => getShuffledColors(game.id),
    [game.id],
  );

  function getTc(index: number | null | undefined) {
    if (index == null || shuffledColors.length === 0) return null;
    return shuffledColors[index % shuffledColors.length];
  }

  const currentThrower = state.currentThrowerId
    ? usersById.get(state.currentThrowerId)
    : null;
  const winner = state.winnerId ? usersById.get(state.winnerId) : null;
  const pendingScore = throwScoreFromPins([...selected]);

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      {/* Status banner */}
      <Card padding="p-4">
        {winner ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={winner.name}
              url={winner.avatar_url}
              size={44}
              isBuck={winner.is_buck}
            />
            <div className="flex-1">
              <div className="text-xs text-muted">Winner</div>
              <div className="font-semibold">🏆 {winner.name} wins at 50</div>
            </div>
          </div>
        ) : currentThrower ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={currentThrower.name}
              url={currentThrower.avatar_url}
              size={44}
              isBuck={currentThrower.is_buck}
            />
            <div className="flex-1">
              <div className="text-xs text-muted">Up next</div>
              <div className="font-semibold">
                {hasTeams && teamByUserId.get(currentThrower.id) != null
                  ? `${getTc(teamByUserId.get(currentThrower.id))?.name} Team's throw`
                  : `${currentThrower.name}'s throw`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Score</div>
              <div className="font-semibold tabular-nums">
                {state.totals[currentThrower.id] ?? 0}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted text-center">
            No active players.
          </div>
        )}
      </Card>

      {/* Pin diamond */}
      <Card>
        <div className="flex flex-col items-center gap-2">
          {PIN_DIAMOND.map((row, i) => (
            <div key={i} className="flex gap-2 justify-center">
              {row.map((n) => {
                const isSelected = selected.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => togglePin(n)}
                    disabled={finished || submitting || !currentThrower}
                    aria-label={`Pin ${n}`}
                    aria-pressed={isSelected}
                    className={clsx(
                      "w-12 h-12 rounded-full border-2 text-base font-bold tabular-nums transition",
                      isSelected
                        ? "bg-accent text-white border-accent shadow-card"
                        : "bg-surface text-ink border-line hover:bg-surface2",
                      (finished || !currentThrower) && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onMiss}
            disabled={finished || submitting || !currentThrower}
            className="col-span-1 rounded-card border border-line bg-surface px-4 py-4 text-base font-semibold disabled:opacity-50"
          >
            Miss
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              finished || submitting || !currentThrower || selected.size === 0
            }
            className="col-span-2 rounded-card bg-accent text-white px-4 py-4 text-base font-semibold disabled:opacity-50"
          >
            {selected.size === 0
              ? "Confirm"
              : `Confirm +${pendingScore} (${selected.size} pin${selected.size === 1 ? "" : "s"})`}
          </button>
        </div>
      </Card>

      {/* Player list */}
      <Card padding="p-2">
        <ul className="flex flex-col gap-1">
          {orderedPlayers.map((p, i) => {
            const u = usersById.get(p.user_id);
            if (!u) return null;
            const total = state.totals[p.user_id] ?? 0;
            const miss = state.missStreak[p.user_id] ?? 0;
            const isElim = state.eliminated.has(p.user_id);
            const isWinner = state.winnerId === p.user_id;
            const isCurrent = state.currentThrowerId === p.user_id;
            const ti = hasTeams ? teamByUserId.get(p.user_id) : undefined;
            const prevPlayer = i > 0 ? orderedPlayers[i - 1] : null;
            const prevTi = prevPlayer && hasTeams ? teamByUserId.get(prevPlayer.user_id) : undefined;
            const isNewTeam = ti != null && ti !== prevTi;
            const tc = getTc(ti);

            return (
              <li key={p.user_id}>
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
                    <span className="tabular-nums ml-auto font-semibold">
                      {total}
                    </span>
                    <span className="text-xs text-muted">/ {FINSKA.winScore}</span>
                  </div>
                )}
                <div
                  className={clsx(
                    "flex items-center gap-3 rounded-card px-3 py-3",
                    isCurrent && "ring-2 ring-accent bg-accentSoft/40",
                    isElim && "opacity-50",
                  )}
                  style={tc ? { borderLeft: `4px solid ${tc.hex}` } : undefined}
                >
                  <Avatar name={u.name} url={u.avatar_url} size={36} isBuck={u.is_buck} />
                  <div className="flex-1 min-w-0">
                    <div
                      className={clsx(
                        "font-medium truncate",
                        isElim && "line-through",
                      )}
                    >
                      {isWinner && "🏆 "}
                      {u.name}
                    </div>
                    {miss > 0 && !isElim && (
                      <div className="text-xs text-muted mt-0.5">
                        Misses: {miss}/{FINSKA.missLimit}
                      </div>
                    )}
                    {isElim && (
                      <div className="text-xs text-danger mt-0.5">Eliminated</div>
                    )}
                    {hasTeams && !finished && (
                      <select
                        value={ti ?? ""}
                        onChange={(e) =>
                          assignTeam(p.user_id, e.target.value ? Number(e.target.value) : null)
                        }
                        className="text-xs border border-line rounded-md px-1 py-0.5 bg-surface mt-1 max-w-[80px] truncate"
                      >
                        <option value="">—</option>
                        {Array.from({ length: game.team_count! }, (_, idx) => (
                          <option key={idx} value={idx}>
                            {getTc(idx)?.name ?? `Team ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {!hasTeams && (
                    <div className="flex items-baseline gap-1 tabular-nums pl-2">
                      <span className="font-semibold text-2xl leading-none">{total}</span>
                      <span className="text-xs text-muted">/ {FINSKA.winScore}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* History feed */}
      {state.events.length > 0 && (
        <Card padding="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            Recent throws
          </div>
          <ul className="flex flex-col gap-2 text-sm leading-snug">
            {[...state.events]
              .slice(-12)
              .reverse()
              .map((ev, i) => (
                <li key={i}>{formatEvent(ev, (uid) => {
                  const user = usersById.get(uid);
                  if (!user) return "Player";
                  if (hasTeams) {
                    const ti = teamByUserId.get(uid);
                    if (ti != null) {
                      const tc = getTc(ti);
                      if (tc) return `${tc.name} Team`;
                    }
                  }
                  return user.name;
                })}</li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function formatEvent(
  ev: FinskaThrowEvent,
  formatName: (userId: string) => string,
): string {
  const name = formatName(ev.userId);
  switch (ev.kind) {
    case "hit":
      return `${name} → ${ev.throwScore} (total ${ev.newTotal})`;
    case "miss":
      return `${name} missed (${ev.streak}/${FINSKA.missLimit})`;
    case "bust":
      return `${name} busted on ${ev.throwScore} → reset to ${FINSKA.bustResetTo}`;
    case "eliminated":
      return `${name} eliminated`;
    case "win":
      return `🏆 ${name} wins at ${FINSKA.winScore}`;
  }
}
