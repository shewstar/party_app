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

  const state = useMemo(() => computeFinskaState(players, throws), [players, throws]);

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

  const orderedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ao = a.throw_order;
      const bo = b.throw_order;
      if (ao == null && bo == null) return 0;
      if (ao == null) return 1;
      if (bo == null) return -1;
      return ao - bo;
    });
  }, [players]);

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
              <div className="font-semibold">{currentThrower.name}'s throw</div>
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
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onMiss}
            disabled={finished || submitting || !currentThrower}
            className="flex-1 rounded-card border border-line bg-surface py-3 font-semibold disabled:opacity-50"
          >
            Miss
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              finished || submitting || !currentThrower || selected.size === 0
            }
            className="flex-[2] rounded-card bg-accent text-white py-3 font-semibold disabled:opacity-50"
          >
            {selected.size === 0
              ? "Confirm"
              : `Confirm +${pendingScore} (${selected.size} pin${selected.size === 1 ? "" : "s"})`}
          </button>
        </div>
      </Card>

      {/* Player list */}
      <Card padding="p-3">
        <ul className="flex flex-col gap-2">
          {orderedPlayers.map((p) => {
            const u = usersById.get(p.user_id);
            if (!u) return null;
            const total = state.totals[p.user_id] ?? 0;
            const miss = state.missStreak[p.user_id] ?? 0;
            const isElim = state.eliminated.has(p.user_id);
            const isWinner = state.winnerId === p.user_id;
            const isCurrent = state.currentThrowerId === p.user_id;
            return (
              <li
                key={p.user_id}
                className={clsx(
                  "flex items-center gap-3 rounded-card px-2 py-2",
                  isCurrent && "ring-2 ring-accent bg-accentSoft/40",
                  isElim && "opacity-50",
                )}
              >
                <Avatar name={u.name} url={u.avatar_url} size={32} isBuck={u.is_buck} />
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
                    <div className="text-xs text-muted">
                      Misses: {miss}/{FINSKA.missLimit}
                    </div>
                  )}
                  {isElim && (
                    <div className="text-xs text-danger">Eliminated</div>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold text-lg">{total}</div>
                  <div className="text-xs text-muted">/ {FINSKA.winScore}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* History feed */}
      {state.events.length > 0 && (
        <Card padding="p-3">
          <div className="text-xs font-semibold text-muted mb-2 px-1">
            Recent throws
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {[...state.events]
              .slice(-12)
              .reverse()
              .map((ev, i) => (
                <li key={i} className="px-1">
                  {formatEvent(ev, usersById)}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function formatEvent(
  ev: FinskaThrowEvent,
  usersById: Map<string, UserRow>,
): string {
  const name = usersById.get(ev.userId)?.name ?? "Player";
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
