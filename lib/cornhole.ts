// Cornhole preset: rules, scoring, and derived-state helper.
// All Cornhole game state is computed from the raw game_scores rows — there
// is no extra persisted state to keep in sync.
//
// Each game_scores row represents one bag (score = 0 miss, 1 board, 3 hole).
// When teams are active (teamCount >= 2), rounds are tracked per-team
// (4 bags per team). Otherwise per-player (4 bags per player).

export const CORNHOLE = {
  id: "cornhole" as const,
  label: "Cornhole",
  winScore: 21,
  bagsPerTurn: 4,
  bagPoints: {
    board: 1,
    hole: 3,
    miss: 0,
  } as const,
};

export type BagResult = "board" | "hole" | "miss";

export type CornholeThrowEvent =
  | {
      kind: "turn";
      userId: string;
      rawScore: number;
      ts: string;
    }
  | {
      kind: "round_score";
      userId: string;
      roundPoints: number;
      newTotal: number;
      ts: string;
    }
  | {
      kind: "win";
      userId: string;
      ts: string;
    };

export type CornholeState = {
  totals: Record<string, number>;
  winnerId: string | null;
  currentThrowerId: string | null;
  throwCount: number;
  events: CornholeThrowEvent[];
  bagsThisRound: Record<string, number>;
};

type PlayerInput = { user_id: string; throw_order: number | null; team_index: number | null };
type ThrowInput = { user_id: string; score: number; recorded_at: string };

export function computeCornholeState(
  players: PlayerInput[],
  throws: ThrowInput[],
  teamCount: number | null,
): CornholeState {
  const ordered = [...players].sort((a, b) => {
    const ao = a.throw_order;
    const bo = b.throw_order;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });

  const useTeams = teamCount != null && teamCount >= 2;

  const teamByUserId = new Map<string, number | null>();
  for (const p of ordered) teamByUserId.set(p.user_id, p.team_index);

  function teamKey(uid: string): string {
    const ti = teamByUserId.get(uid);
    return ti != null ? `t:${ti}` : uid;
  }

  const totals: Record<string, number> = {};
  for (const p of ordered) totals[p.user_id] = 0;

  const sorted = [...throws].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const events: CornholeThrowEvent[] = [];
  let winnerId: string | null = null;

  const bagCounts: Record<string, number> = {};
  for (const p of ordered) bagCounts[useTeams ? teamKey(p.user_id) : p.user_id] = 0;

  let roundThrows: ThrowInput[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (winnerId) break;
    const t = sorted[i];
    const uid = t.user_id;
    const key = useTeams ? teamKey(uid) : uid;

    const currentCount = bagCounts[key] ?? 0;
    if (currentCount >= CORNHOLE.bagsPerTurn) {
      const roundWinner = scoreRound(roundThrows, totals, events, useTeams ? teamByUserId : null);
      if (roundWinner) { winnerId = roundWinner; break; }
      for (const k of Object.keys(bagCounts)) bagCounts[k] = 0;
      roundThrows = [];
    }

    bagCounts[key] = (bagCounts[key] ?? 0) + 1;
    roundThrows.push(t);
    events.push({ kind: "turn", userId: uid, rawScore: t.score, ts: t.recorded_at });
  }

  // Score final round only if every active unit has 4 bags.
  if (!winnerId && roundThrows.length > 0) {
    const allDone = Object.values(bagCounts).every((c) => c >= CORNHOLE.bagsPerTurn);
    if (allDone) {
      const roundWinner = scoreRound(roundThrows, totals, events, useTeams ? teamByUserId : null);
      if (roundWinner) winnerId = roundWinner;
      for (const k of Object.keys(bagCounts)) bagCounts[k] = 0;
    }
  }

  // Current thrower: alternate by team (or individual if no teams).
  let currentThrowerId: string | null = null;
  if (!winnerId && ordered.length > 0) {
    if (useTeams) {
      const teamOrder: string[] = [];
      const teamPlayers = new Map<string, string[]>();
      for (const p of ordered) {
        if (p.team_index != null) {
          const k = `t:${p.team_index}`;
          if (!teamPlayers.has(k)) {
            teamPlayers.set(k, []);
            teamOrder.push(k);
          }
          teamPlayers.get(k)!.push(p.user_id);
        } else {
          const k = `u:${p.user_id}`;
          teamPlayers.set(k, [p.user_id]);
          teamOrder.push(k);
        }
      }
      let nextIdx = 0;
      if (sorted.length > 0) {
        const lastUid = sorted[sorted.length - 1].user_id;
        const lp = ordered.find((p) => p.user_id === lastUid);
        const lastKey = lp?.team_index != null ? `t:${lp.team_index}` : `u:${lastUid}`;
        const found = teamOrder.indexOf(lastKey);
        if (found !== -1) nextIdx = (found + 1) % teamOrder.length;
      }
      const nextKey = teamOrder[nextIdx];
      const candidates = teamPlayers.get(nextKey) ?? [];
      let bestId: string | null = null;
      let bestCount = Infinity;
      for (const uid of candidates) {
        if ((bagCounts[teamKey(uid)] ?? 0) >= CORNHOLE.bagsPerTurn) continue;
        const c = bagCounts[teamKey(uid)] ?? 0;
        if (c < bestCount) { bestCount = c; bestId = uid; }
      }
      currentThrowerId = bestId;
    } else {
      const allDone = ordered.every(
        (p) => (bagCounts[p.user_id] ?? 0) >= CORNHOLE.bagsPerTurn,
      );
      if (sorted.length === 0 || allDone) {
        currentThrowerId = ordered[0].user_id;
      } else {
        const lastUid = sorted[sorted.length - 1].user_id;
        const lastIdx = ordered.findIndex((p) => p.user_id === lastUid);
        for (let step = 1; step <= ordered.length; step++) {
          const candidate = ordered[(lastIdx + step) % ordered.length];
          if ((bagCounts[candidate.user_id] ?? 0) < CORNHOLE.bagsPerTurn) {
            currentThrowerId = candidate.user_id; break;
          }
        }
        if (!currentThrowerId) currentThrowerId = ordered[0].user_id;
      }
    }
  }

  // bagsThisRound: when teams active, keyed by team. Otherwise by user.
  const bagsThisRound: Record<string, number> = {};
  if (useTeams) {
    for (const [k, v] of Object.entries(bagCounts)) bagsThisRound[k] = v;
  } else {
    for (const p of ordered) bagsThisRound[p.user_id] = bagCounts[p.user_id] ?? 0;
  }

  return { totals, winnerId, currentThrowerId, throwCount: sorted.length, events, bagsThisRound };
}

function scoreRound(
  roundThrows: ThrowInput[],
  totals: Record<string, number>,
  events: CornholeThrowEvent[],
  teamByUserId: Map<string, number | null> | null,
): string | null {
  // Aggregate scores: per-user (solo) or per-team.
  const scores: Record<string, number> = {};
  const keyToUser: Record<string, string> = {};
  for (const t of roundThrows) {
    const key = teamByUserId
      ? `t:${teamByUserId.get(t.user_id) ?? t.user_id}`
      : t.user_id;
    scores[key] = (scores[key] ?? 0) + t.score;
    if (!keyToUser[key]) keyToUser[key] = t.user_id;
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const highest = entries[0];
  const secondScore = entries.length > 1 ? entries[1][1] : 0;

  if (highest[1] > secondScore) {
    const roundPoints = highest[1] - secondScore;
    const representativeId = keyToUser[highest[0]];

    // Add points to every player in the winning unit (team or individual).
    if (teamByUserId && highest[0].startsWith("t:")) {
      const ti = Number(highest[0].slice(2));
      for (const [uid, total] of Object.entries(totals)) {
        if (teamByUserId.get(uid) === ti) totals[uid] = total + roundPoints;
      }
    } else {
      totals[representativeId] = (totals[representativeId] ?? 0) + roundPoints;
    }

    const newTotal = totals[representativeId];
    const ts = roundThrows[roundThrows.length - 1].recorded_at;
    events.push({ kind: "round_score", userId: representativeId, roundPoints, newTotal, ts });

    if (newTotal >= CORNHOLE.winScore) {
      events.push({ kind: "win", userId: representativeId, ts });
      return representativeId;
    }
  }

  return null;
}

export function bagScore(bag: BagResult): number {
  return CORNHOLE.bagPoints[bag];
}

export function turnScoreFromBags(bags: BagResult[]): number {
  return bags.reduce((sum, b) => sum + CORNHOLE.bagPoints[b], 0);
}
