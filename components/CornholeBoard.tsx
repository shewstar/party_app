"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase/browser";
import { useHaptic } from "@/lib/haptics";
import { useOnlineStatus } from "@/lib/offline-queue";
import { useRefreshTable, useTableData } from "@/lib/realtime-provider";
import {
  CORNHOLE,
  bagScore,
  computeCornholeState,
  turnScoreFromBags,
  type BagResult,
  type CornholeThrowEvent,
} from "@/lib/cornhole";
import type {
  GamePlayerRow,
  GameRow,
  GameScoreRow,
  UserRow,
} from "@/lib/supabase/types";
import clsx from "@/components/clsx";
import { getShuffledColors } from "@/lib/team-colors";

type PlacedBag = {
  id: number;
  result: BagResult;
  xPct: number;
  yPct: number;
  rotation: number;
};

type Phase = "throwing" | "scoring";

type Props = {
  game: GameRow;
  finished: boolean;
  onAutoFinish: () => void;
};

export default function CornholeBoard({ game, finished, onAutoFinish }: Props) {
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

  const state = useMemo(() => computeCornholeState(players, throws, game.team_count), [players, throws, game.team_count]);

  useEffect(() => {
    if (state.winnerId && !finished) onAutoFinish();
  }, [state.winnerId, finished, onAutoFinish]);

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

  // --- Two-phase state ---

  const [phase, setPhase] = useState<Phase>("throwing");
  const [throwCounts, setThrowCounts] = useState<Record<string, number>>({});
  const [lastThrower, setLastThrower] = useState<string | null>(null);
  const [bags, setBags] = useState<PlacedBag[]>([]);
  const [nextId, setNextId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completedScored, setCompletedScored] = useState<Set<string>>(new Set());
  const phaseSynced = useRef(false);

  // Helper to get the unit key (team or individual) for bag tracking.
  function unitKey(uid: string): string {
    if (!hasTeams) return uid;
    const ti = teamByUserId.get(uid);
    return ti != null ? `t:${ti}` : uid;
  }

  // On mount, sync phase & completedScored from DB state (handles page refresh
  // mid-round).
  useEffect(() => {
    if (phaseSynced.current) return;
    const hasAny = Object.values(state.bagsThisRound).some((c) => c > 0);
    if (!hasAny) return;
    const allDone = hasTeams
      ? Object.values(state.bagsThisRound).every((c) => c >= CORNHOLE.bagsPerTurn)
      : orderedPlayers.every((p) => (state.bagsThisRound[p.user_id] ?? 0) >= CORNHOLE.bagsPerTurn);
    if (allDone) { phaseSynced.current = true; return; }
    // Mid-scoring: initialise completedScored from bags already recorded.
    if (hasTeams) {
      const done = new Set<string>();
      for (const [k, v] of Object.entries(state.bagsThisRound)) {
        if (v >= CORNHOLE.bagsPerTurn) done.add(k);
      }
      setCompletedScored(done);
    } else {
      setCompletedScored(
        new Set(
          orderedPlayers
            .filter((p) => (state.bagsThisRound[p.user_id] ?? 0) >= CORNHOLE.bagsPerTurn)
            .map((p) => p.user_id),
        ),
      );
    }
    setPhase("scoring");
    phaseSynced.current = true;
  }, [state.bagsThisRound, orderedPlayers, hasTeams, teamByUserId]);

  // Determine current player for each phase.
  // When teams are active, alternate by team and pick the least-used player
  // within the team. Otherwise walk individual rotation.

  const teamOrder = useMemo(() => {
    if (!hasTeams) return null;
    const order: string[] = [];
    for (const p of orderedPlayers) {
      if (p.team_index != null) {
        const key = `t:${p.team_index}`;
        if (!order.includes(key)) order.push(key);
      } else {
        order.push(`u:${p.user_id}`);
      }
    }
    return order.length >= 2 ? order : null;
  }, [hasTeams, orderedPlayers]);

  const throwingPlayerId = useMemo(() => {
    if (phase !== "throwing" || orderedPlayers.length === 0) return null;
    if (!lastThrower) return orderedPlayers[0].user_id;

    if (teamOrder) {
      const lastTi = teamByUserId.get(lastThrower);
      const lastKey = lastTi != null ? `t:${lastTi}` : `u:${lastThrower}`;
      const lastTeamIdx = teamOrder.indexOf(lastKey);
      const nextTeamIdx = lastTeamIdx >= 0 ? (lastTeamIdx + 1) % teamOrder.length : 0;
      const nextTeam = teamOrder[nextTeamIdx];
      // Within this team, pick the player with fewest throws who isn't done.
      let bestId: string | null = null;
      let bestCount = Infinity;
      for (const p of orderedPlayers) {
        const pk = p.team_index != null ? `t:${p.team_index}` : `u:${p.user_id}`;
        if (pk !== nextTeam) continue;
        const teamBagCount = throwCounts[pk] ?? 0;
        if (teamBagCount >= CORNHOLE.bagsPerTurn) continue;
        const c = throwCounts[unitKey(p.user_id)] ?? 0;
        if (c < bestCount) { bestCount = c; bestId = p.user_id; }
      }
      return bestId;
    }

    const lastIdx = orderedPlayers.findIndex((p) => p.user_id === lastThrower);
    for (let step = 1; step <= orderedPlayers.length; step++) {
      const candidate = orderedPlayers[(lastIdx + step) % orderedPlayers.length];
      if ((throwCounts[candidate.user_id] ?? 0) < CORNHOLE.bagsPerTurn) {
        return candidate.user_id;
      }
    }
    return null;
  }, [phase, orderedPlayers, lastThrower, throwCounts, teamOrder, teamByUserId]);

  const scoringPlayerId = useMemo(() => {
    if (phase !== "scoring") return null;

    if (teamOrder) {
      // Find the first team that hasn't completed scoring.
      for (const tk of teamOrder) {
        if (completedScored.has(String(tk))) continue;
        // Pick any player from this team who can score.
        for (const p of orderedPlayers) {
          const pk = p.team_index != null ? `t:${p.team_index}` : `u:${p.user_id}`;
          if (pk === tk) return p.user_id;
        }
      }
      return null;
    }

    for (const p of orderedPlayers) {
      if (!completedScored.has(p.user_id)) return p.user_id;
    }
    return null;
  }, [phase, orderedPlayers, completedScored, teamOrder]);

  // Clear bags when scoring player changes.
  const prevScoringRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "scoring" && scoringPlayerId && scoringPlayerId !== prevScoringRef.current) {
      setBags([]);
    }
    prevScoringRef.current = scoringPlayerId;
  }, [phase, scoringPlayerId]);

  // --- Throwing phase handlers ---

  function handleThrown() {
    if (finished || phase !== "throwing") return;
    const uid = throwingPlayerId;
    if (!uid) return;
    haptic.light();

    const key = unitKey(uid);
    const nextCounts = { ...throwCounts, [key]: (throwCounts[key] ?? 0) + 1 };
    setThrowCounts(nextCounts);
    setLastThrower(uid);

    const allDone = hasTeams
      ? Object.values(nextCounts).every((c) => c >= CORNHOLE.bagsPerTurn)
      : orderedPlayers.every(
          (p) => (nextCounts[p.user_id] ?? 0) >= CORNHOLE.bagsPerTurn,
        );
    if (allDone) {
      setPhase("scoring");
      setBags([]);
      setCompletedScored(new Set());
      setLastThrower(null);
    }
  }

  // --- Scoring phase handlers ---

  const boardActive = phase === "scoring" && !finished && !!scoringPlayerId && !submitting;

  function placeBag(result: BagResult, xPct: number, yPct: number) {
    if (!boardActive || bags.length >= CORNHOLE.bagsPerTurn) return;
    haptic.light();
    const rotation = (Math.random() - 0.5) * 140;
    setBags((prev) => [...prev, { id: nextId, result, xPct, yPct, rotation }]);
    setNextId((n) => n + 1);
  }

  function removeBag(id: number) {
    if (!boardActive) return;
    haptic.light();
    setBags((prev) => prev.filter((b) => b.id !== id));
  }

  function handleBoardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!boardActive || bags.length >= CORNHOLE.bagsPerTurn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    placeBag("board", xPct, yPct);
  }

  function handleHoleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!boardActive || bags.length >= CORNHOLE.bagsPerTurn) return;
    const holeEl = e.currentTarget;
    const boardEl = holeEl.parentElement;
    if (!boardEl) return;
    const holeRect = holeEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const cx = ((holeRect.left + holeRect.width / 2 - boardRect.left) / boardRect.width) * 100;
    const cy = ((holeRect.top + holeRect.height / 2 - boardRect.top) / boardRect.height) * 100;
    const jx = (Math.random() - 0.5) * 6;
    const jy = (Math.random() - 0.5) * 6;
    placeBag("hole", cx + jx, cy + jy);
  }

  function handleMiss() {
    if (!boardActive || bags.length >= CORNHOLE.bagsPerTurn) return;
    placeBag("miss", 0, 0);
  }

  function handleResetBags() {
    if (!boardActive) return;
    haptic.light();
    setBags([]);
  }

  async function assignTeam(userId: string, teamIndex: number | null) {
    await supabase()
      .from("game_players")
      .update({ team_index: teamIndex })
      .eq("game_id", game.id)
      .eq("user_id", userId);
    await refreshTable("game_players");
  }

  async function onConfirmScore() {
    if (!scoringPlayerId || finished || bags.length === 0) return;
    setSubmitting(true);
    haptic.medium();

    const rows = bags.map((b) => ({
      game_id: game.id,
      user_id: scoringPlayerId,
      score: bagScore(b.result),
    }));

    if (!online) {
      for (const row of rows) enqueue("game_scores", row);
    } else {
      await supabase().from("game_scores").insert(rows);
      await refreshTable("game_scores");
    }
    setBags([]);

    // Advance scoring: mark this team/player as done, move to next or finish.
    const scKey = unitKey(scoringPlayerId);
    const nextCompleted = new Set(completedScored);
    nextCompleted.add(scKey);
    setCompletedScored(nextCompleted);

    const allDone = hasTeams
      ? teamOrder?.every((tk) => nextCompleted.has(String(tk)))
      : orderedPlayers.every((p) => nextCompleted.has(p.user_id));
    if (allDone) {
      setPhase("throwing");
      setThrowCounts({});
      setLastThrower(null);
      setCompletedScored(new Set());
    }
    setSubmitting(false);
  }

  // --- Derived data ---

  const throwingPlayer = throwingPlayerId ? usersById.get(throwingPlayerId) : null;
  const scoringPlayer = scoringPlayerId ? usersById.get(scoringPlayerId) : null;
  const winner = state.winnerId ? usersById.get(state.winnerId) : null;

  const boardBags = bags.filter((b) => b.result === "board");
  const holeBags = bags.filter((b) => b.result === "hole");
  const missBags = bags.filter((b) => b.result === "miss");
  const pendingScore = bags.length > 0 ? turnScoreFromBags(bags.map((b) => b.result)) : null;

  const throwingBag = throwingPlayerId
    ? (throwCounts[unitKey(throwingPlayerId)] ?? 0) + 1
    : 0;

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
              <div className="font-semibold">
                🏆 {winner.name} wins at {CORNHOLE.winScore}
              </div>
            </div>
          </div>
        ) : phase === "throwing" && throwingPlayer ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={throwingPlayer.name}
              url={throwingPlayer.avatar_url}
              size={44}
              isBuck={throwingPlayer.is_buck}
            />
            <div className="flex-1">
              <div className="text-xs text-muted">To throw</div>
              <div className="font-semibold">
                {hasTeams && teamByUserId.get(throwingPlayer.id) != null
                  ? `${getTc(teamByUserId.get(throwingPlayer.id))?.name} Team · bag ${throwingBag}/${CORNHOLE.bagsPerTurn}`
                  : `${throwingPlayer.name} · bag ${throwingBag}/${CORNHOLE.bagsPerTurn}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Score</div>
              <div className="font-semibold tabular-nums">
                {state.totals[throwingPlayer.id] ?? 0}
              </div>
            </div>
          </div>
        ) : phase === "scoring" && scoringPlayer ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={scoringPlayer.name}
              url={scoringPlayer.avatar_url}
              size={44}
              isBuck={scoringPlayer.is_buck}
            />
            <div className="flex-1">
              <div className="text-xs text-muted">Place bags</div>
              <div className="font-semibold">
                {hasTeams && teamByUserId.get(scoringPlayer.id) != null
                  ? `${getTc(teamByUserId.get(scoringPlayer.id))?.name} Team · ${bags.length}/${CORNHOLE.bagsPerTurn} placed`
                  : `${scoringPlayer.name} · ${bags.length}/${CORNHOLE.bagsPerTurn} placed`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Score</div>
              <div className="font-semibold tabular-nums">
                {state.totals[scoringPlayer.id] ?? 0}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted text-center">
            No active players.
          </div>
        )}
      </Card>

      {/* Phase-specific content */}
      {phase === "throwing" && !winner && (
        <Card padding="p-4">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted text-center">
              Tap &ldquo;Thrown&rdquo; each time a player tosses a bag.
              <br />
              All {CORNHOLE.bagsPerTurn * orderedPlayers.length} bags must be tossed before scoring.
            </p>
            <button
              type="button"
              onClick={handleThrown}
              disabled={finished || !throwingPlayerId}
              className="w-full max-w-[260px] rounded-card bg-accent text-white py-4 text-lg font-semibold disabled:opacity-50"
            >
               {throwingPlayer
                 ? hasTeams && teamByUserId.get(throwingPlayer.id) != null
                   ? `${getTc(teamByUserId.get(throwingPlayer.id))?.name} Team thrown (bag ${throwingBag}/${CORNHOLE.bagsPerTurn})`
                   : `${throwingPlayer.name} thrown (bag ${throwingBag}/${CORNHOLE.bagsPerTurn})`
                : "All bags tossed"}
            </button>
          </div>
        </Card>
      )}

      {phase === "scoring" && !winner && (
        <Card>
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs text-muted">
              Tap board for on-board &middot; tap hole for in hole &middot; Miss for off-board
            </div>

            {/* Board */}
            <div
              onClick={handleBoardClick}
              className={clsx(
                "relative w-full max-w-[260px] select-none",
                "rounded-xl overflow-hidden border-2 border-stone-500",
                !boardActive && "pointer-events-none opacity-50",
              )}
              style={{ aspectRatio: "2 / 3" }}
            >
              {/* Wood surface */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, #d4c5a9 0%, #c7b798 30%, #baa683 60%, #ad9b72 100%)",
                }}
              />

              {/* Wood grain */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,0,0,0.3) 40px, rgba(0,0,0,0.3) 41px)",
                }}
              />

              {/* Hole */}
              <div
                onClick={handleHoleClick}
                className={clsx(
                  "absolute left-1/2 -translate-x-1/2 w-[22%] rounded-full cursor-pointer z-10",
                  "bg-gray-900 border-2 border-gray-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]",
                  !boardActive && "pointer-events-none",
                )}
                style={{ top: "17%", aspectRatio: "1 / 1" }}
              >
                <div className="absolute inset-[20%] rounded-full bg-black" />
              </div>

              {/* Board bag markers */}
              {boardBags.map((bag) => (
                <button
                  key={bag.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBag(bag.id);
                  }}
                  className={clsx(
                    "absolute w-[32px] h-[26px] rounded-[4px] cursor-pointer z-20",
                    "bg-[#3a4f6b] border border-[#2a3d55]",
                    "shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
                    "hover:brightness-125 hover:shadow-lg transition-[filter,box-shadow]",
                  )}
                  style={{
                    left: `calc(${bag.xPct}% - 16px)`,
                    top: `calc(${bag.yPct}% - 13px)`,
                    transform: `rotate(${bag.rotation}deg)`,
                  }}
                  aria-label={`Remove on-board bag`}
                />
              ))}

              {/* Hole bag markers (non-interactive — tap hole to add, use Reset to clear) */}
              {holeBags.map((bag) => (
                <div
                  key={bag.id}
                  className={clsx(
                    "absolute w-[32px] h-[26px] rounded-[4px] pointer-events-none z-20",
                    "bg-[#3a4f6b] border border-[#2a3d55]",
                    "shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
                  )}
                  style={{
                    left: `calc(${bag.xPct}% - 16px)`,
                    top: `calc(${bag.yPct}% - 13px)`,
                    transform: `rotate(${bag.rotation}deg)`,
                  }}
                />
              ))}
            </div>

            {/* Bag counter */}
            <div className="text-sm text-muted tabular-nums">
              {bags.length < CORNHOLE.bagsPerTurn
                ? `${bags.length}/${CORNHOLE.bagsPerTurn} bags placed · ${CORNHOLE.bagsPerTurn - bags.length} left`
                : `${CORNHOLE.bagsPerTurn}/${CORNHOLE.bagsPerTurn} bags placed`}
            </div>

            {/* Miss bags row */}
            <div className="flex gap-2 items-center min-h-[20px]">
              {missBags.length > 0 && (
                <>
                  <span className="text-xs text-muted">Off board:</span>
                  {missBags.map((bag) => (
                    <button
                      key={bag.id}
                      type="button"
                      onClick={() => removeBag(bag.id)}
                      className={clsx(
                        "w-[32px] h-[26px] rounded-[4px] cursor-pointer",
                        "bg-[#3a4f6b] border border-[#2a3d55]",
                        "shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
                        "hover:brightness-125 hover:shadow-lg transition-[filter,box-shadow]",
                      )}
                      style={{ transform: `rotate(${bag.rotation}deg)` }}
                      aria-label={`Remove miss bag`}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="w-full max-w-[260px] grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={handleMiss}
                disabled={!boardActive || bags.length >= CORNHOLE.bagsPerTurn}
                className="col-span-1 rounded-card border border-line bg-surface px-1 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Miss
              </button>
              <button
                type="button"
                onClick={handleResetBags}
                disabled={!boardActive || bags.length === 0}
                className="col-span-1 rounded-card border border-line bg-surface px-1 py-3 text-xs font-medium disabled:opacity-50"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={onConfirmScore}
                disabled={!boardActive || bags.length === 0}
                className="col-span-4 rounded-card bg-accent text-white px-3 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {bags.length === 0
                  ? "Confirm"
                  : `Confirm +${pendingScore} (${bags.length} bag${bags.length === 1 ? "" : "s"})`}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Player list */}
      <Card padding="p-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 px-1">
          Players
        </div>
        <ul className="flex flex-col gap-1">
          {orderedPlayers.map((p, i) => {
            const u = usersById.get(p.user_id);
            if (!u) return null;
            const total = state.totals[p.user_id] ?? 0;
            const isWinner = state.winnerId === p.user_id;
            const isCurrentScoring =
              phase === "scoring" && scoringPlayerId === p.user_id;
            const isCurrentThrowing =
              phase === "throwing" && throwingPlayerId === p.user_id;
            const isCurrent = isCurrentScoring || isCurrentThrowing;
            const ti = hasTeams ? teamByUserId.get(p.user_id) : undefined;
            const teamKey = hasTeams && ti != null ? `t:${ti}` : p.user_id;
            const teamBagsScored = state.bagsThisRound[teamKey] ?? 0;
            const teamBagsThrown = throwCounts[teamKey] ?? 0;
            const bagsScored = state.bagsThisRound[p.user_id] ?? 0;
            const throwsDone = throwCounts[p.user_id] ?? 0;
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
                    <span className="text-xs text-muted">/ {CORNHOLE.winScore}</span>
                    {hasTeams && phase === "throwing" && teamBagsThrown > 0 && (
                      <span className="text-xs text-muted tabular-nums">
                        {teamBagsThrown}/{CORNHOLE.bagsPerTurn}
                      </span>
                    )}
                    {hasTeams && phase === "scoring" && teamBagsScored > 0 && (
                      <span className="text-xs text-muted tabular-nums">
                        {teamBagsScored}/{CORNHOLE.bagsPerTurn}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={clsx(
                    "flex items-center gap-3 rounded-card px-3 py-3",
                    isCurrent && "ring-2 ring-accent bg-accentSoft/40",
                  )}
                  style={tc ? { borderLeft: `4px solid ${tc.hex}` } : undefined}
                >
                  <Avatar
                    name={u.name}
                    url={u.avatar_url}
                    size={36}
                    isBuck={u.is_buck}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {isWinner && "🏆 "}
                      {u.name}
                    </div>
                    {!hasTeams && phase === "throwing" && throwsDone > 0 && (
                      <div className="text-xs text-muted mt-0.5">
                        {throwsDone}/{CORNHOLE.bagsPerTurn} thrown
                      </div>
                    )}
                    {!hasTeams && phase === "scoring" && (
                      <div className="text-xs text-muted mt-0.5">
                        {bagsScored}/{CORNHOLE.bagsPerTurn} scored
                      </div>
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
                      <span className="font-semibold text-2xl leading-none">
                        {total}
                      </span>
                      <span className="text-xs text-muted">
                        / {CORNHOLE.winScore}
                      </span>
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
  ev: CornholeThrowEvent,
  formatName: (userId: string) => string,
): string {
  const name = formatName(ev.userId);
  switch (ev.kind) {
    case "turn":
      return `${name} → ${ev.rawScore} pt${ev.rawScore === 1 ? "" : "s"}`;
    case "round_score":
      return `→ ${name} +${ev.roundPoints} (total ${ev.newTotal})`;
    case "win":
      return `🏆 ${name} wins at ${CORNHOLE.winScore}`;
  }
}
