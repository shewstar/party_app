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

type PlayerInput = { user_id: string; throw_order: number | null };
type ThrowInput = { user_id: string; score: number; recorded_at: string };

export function computeFinskaState(
  players: PlayerInput[],
  throws: ThrowInput[],
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

  for (const p of ordered) {
    totals[p.user_id] = 0;
    missStreak[p.user_id] = 0;
  }

  const sorted = [...throws].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  for (const t of sorted) {
    if (winnerId) break;
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

  // Last-player-standing wins (Mölkky rule).
  if (!winnerId) {
    const alive = ordered.filter((p) => !eliminated.has(p.user_id));
    if (alive.length === 1 && ordered.length > 1) {
      winnerId = alive[0].user_id;
      const ts = sorted.length ? sorted[sorted.length - 1].recorded_at : new Date().toISOString();
      events.push({ kind: "win", userId: winnerId, ts });
    }
  }

  // Current thrower: next active player in rotation after the most recent
  // throw. Skips eliminated. Null if the game has a winner.
  let currentThrowerId: string | null = null;
  const active = ordered.filter((p) => !eliminated.has(p.user_id));
  if (!winnerId && active.length > 0) {
    if (sorted.length === 0) {
      currentThrowerId = active[0].user_id;
    } else {
      const lastUid = sorted[sorted.length - 1].user_id;
      const lastIdx = ordered.findIndex((p) => p.user_id === lastUid);
      // Walk the rotation from lastIdx+1 until we hit a non-eliminated player.
      for (let step = 1; step <= ordered.length; step++) {
        const candidate = ordered[(lastIdx + step) % ordered.length];
        if (!eliminated.has(candidate.user_id)) {
          currentThrowerId = candidate.user_id;
          break;
        }
      }
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
