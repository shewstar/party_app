// Finska / Mölkky preset: rules, pin layout, and derived-state helper.
// All Finska game state is computed from the raw game_scores rows — there
// is no extra persisted state to keep in sync.

export const FINSKA = {
  id: "finska" as const,
  label: "Finska",
  winScore: 50,
  bustResetTo: 25,
  missLimit: 3,
};

// Mölkky diamond, back row → front row (rendered top to bottom on screen).
export const PIN_DIAMOND: number[][] = [
  [7, 9, 8],
  [5, 11, 12, 6],
  [3, 10, 4],
  [1, 2],
];

export type FinskaThrowEvent =
  | { kind: "hit"; userId: string; throwScore: number; newTotal: number; ts: string }
  | { kind: "miss"; userId: string; streak: number; ts: string }
  | { kind: "bust"; userId: string; throwScore: number; ts: string }
  | { kind: "eliminated"; userId: string; ts: string }
  | { kind: "win"; userId: string; ts: string };

export type FinskaState = {
  totals: Record<string, number>;
  missStreak: Record<string, number>;
  eliminated: Set<string>;
  winnerId: string | null;
  currentThrowerId: string | null;
  throwCount: number;
  events: FinskaThrowEvent[];
};

type PlayerInput = { user_id: string; throw_order: number | null; team_index: number | null };
type ThrowInput = { user_id: string; score: number; recorded_at: string };

export function computeFinskaState(
  players: PlayerInput[],
  throws: ThrowInput[],
  teamCount: number | null,
): FinskaState {
  // Players in locked throw rotation. NULL throw_order sinks to the end and
  // keeps a stable arrival order — covers players added mid-game.
  const ordered = [...players].sort((a, b) => {
    const ao = a.throw_order;
    const bo = b.throw_order;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });

  const totals: Record<string, number> = {};
  const missStreak: Record<string, number> = {};
  const eliminated = new Set<string>();
  const events: FinskaThrowEvent[] = [];
  let winnerId: string | null = null;

  const useTeams = teamCount != null && teamCount >= 2;

  // Build team lookup and team totals.
  const teamByUserId = new Map<string, number | null>();
  for (const p of ordered) teamByUserId.set(p.user_id, p.team_index);

  const teamTotals: Record<number, number> = {};
  if (useTeams) {
    for (let i = 0; i < teamCount!; i++) teamTotals[i] = 0;
  }

  for (const p of ordered) {
    totals[p.user_id] = 0;
    missStreak[p.user_id] = 0;
  }

  const sorted = [...throws].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  for (const t of sorted) {
    if (winnerId) break;
    // Negative rows are ledger compensations written alongside a busting
    // throw to keep v_game_totals in sync with bust resets — not real throws.
    if (t.score < 0) continue;
    const uid = t.user_id;
    if (eliminated.has(uid)) continue;
    if (!(uid in totals)) {
      totals[uid] = 0;
      missStreak[uid] = 0;
    }

    if (t.score === 0) {
      missStreak[uid] += 1;
      events.push({ kind: "miss", userId: uid, streak: missStreak[uid], ts: t.recorded_at });
      if (missStreak[uid] >= FINSKA.missLimit) {
        eliminated.add(uid);
        events.push({ kind: "eliminated", userId: uid, ts: t.recorded_at });
      }
      continue;
    }

    missStreak[uid] = 0;
    const ti = useTeams ? teamByUserId.get(uid) : undefined;

    if (ti != null) {
      // Team scoring: bust and win checks use the team total.
      const teamTotal = (teamTotals[ti] ?? 0) + t.score;
      if (teamTotal > FINSKA.winScore) {
        teamTotals[ti] = FINSKA.bustResetTo;
        for (const p of ordered) {
          if (teamByUserId.get(p.user_id) === ti) totals[p.user_id] = FINSKA.bustResetTo;
        }
        events.push({ kind: "bust", userId: uid, throwScore: t.score, ts: t.recorded_at });
      } else {
        teamTotals[ti] = teamTotal;
        for (const p of ordered) {
          if (teamByUserId.get(p.user_id) === ti) totals[p.user_id] = teamTotal;
        }
        events.push({ kind: "hit", userId: uid, throwScore: t.score, newTotal: teamTotal, ts: t.recorded_at });
        if (teamTotal === FINSKA.winScore) {
          winnerId = uid;
          events.push({ kind: "win", userId: uid, ts: t.recorded_at });
        }
      }
    } else {
      // Individual scoring.
      const next = totals[uid] + t.score;
      if (next > FINSKA.winScore) {
        totals[uid] = FINSKA.bustResetTo;
        events.push({ kind: "bust", userId: uid, throwScore: t.score, ts: t.recorded_at });
      } else {
        totals[uid] = next;
        events.push({ kind: "hit", userId: uid, throwScore: t.score, newTotal: next, ts: t.recorded_at });
        if (next === FINSKA.winScore) {
          winnerId = uid;
          events.push({ kind: "win", userId: uid, ts: t.recorded_at });
        }
      }
    }
  }

  // Last-player-standing wins (Mölkky rule).
  if (!winnerId) {
    const alive = ordered.filter((p) => !eliminated.has(p.user_id));
    if (alive.length === 1 && ordered.length > 1) {
      winnerId = alive[0].user_id;
      const ts = sorted.length ? sorted[sorted.length - 1].recorded_at : new Date().toISOString();
      events.push({ kind: "win", userId: winnerId, ts });
    }
  }

  // Current thrower: if teams are in use, alternate by team; within a team
  // pick the active player with the fewest throws. Otherwise walk individual
  // rotation. Skips eliminated. Null if the game has a winner.
  let currentThrowerId: string | null = null;
  const active = ordered.filter((p) => !eliminated.has(p.user_id));
  if (!winnerId && active.length > 0) {
    if (!useTeams) {
      if (sorted.length === 0) {
        currentThrowerId = active[0].user_id;
      } else {
        const lastUid = sorted[sorted.length - 1].user_id;
        const lastIdx = ordered.findIndex((p) => p.user_id === lastUid);
        for (let step = 1; step <= ordered.length; step++) {
          const candidate = ordered[(lastIdx + step) % ordered.length];
          if (!eliminated.has(candidate.user_id)) {
            currentThrowerId = candidate.user_id;
            break;
          }
        }
      }
    } else {
      // Team rotation. Build team order: assigned teams first (sorted by
      // team_index), then each unassigned player individually.
      const teamOrder: string[] = [];
      const teamPlayers = new Map<string, string[]>();
      for (const p of ordered) {
        if (p.team_index != null) {
          const key = `t:${p.team_index}`;
          if (!teamPlayers.has(key)) {
            teamPlayers.set(key, []);
            teamOrder.push(key);
          }
          teamPlayers.get(key)!.push(p.user_id);
        } else {
          const key = `u:${p.user_id}`;
          teamPlayers.set(key, [p.user_id]);
          teamOrder.push(key);
        }
      }
      // Count throws per player so we can pick the least-used within a team.
      const perPlayerCounts: Record<string, number> = {};
      for (const t of sorted) {
        perPlayerCounts[t.user_id] = (perPlayerCounts[t.user_id] ?? 0) + 1;
      }
      // Determine which team goes next.
      let nextTeamIdx = 0;
      if (sorted.length > 0) {
        const lastUid = sorted[sorted.length - 1].user_id;
        const lastPlayer = ordered.find((p) => p.user_id === lastUid);
        const lastKey = lastPlayer?.team_index != null ? `t:${lastPlayer.team_index}` : `u:${lastUid}`;
        const idx = teamOrder.indexOf(lastKey);
        if (idx !== -1) nextTeamIdx = (idx + 1) % teamOrder.length;
      }
      const nextTeamKey = teamOrder[nextTeamIdx];
      const candidates = teamPlayers.get(nextTeamKey) ?? [];
      let bestId: string | null = null;
      let bestCount = Infinity;
      for (const uid of candidates) {
        if (eliminated.has(uid)) continue;
        const c = perPlayerCounts[uid] ?? 0;
        if (c < bestCount) {
          bestCount = c;
          bestId = uid;
        }
      }
      currentThrowerId = bestId;
    }
  }

  return {
    totals,
    missStreak,
    eliminated,
    winnerId,
    currentThrowerId,
    throwCount: sorted.length,
    events,
  };
}

// Fisher-Yates shuffle. Used when assigning random throw_order at creation.
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function throwScoreFromPins(selected: number[]): number {
  if (selected.length === 0) return 0;
  if (selected.length === 1) return selected[0];
  return selected.length;
}
