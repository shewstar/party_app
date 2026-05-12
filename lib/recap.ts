import type {
  DrinkRow,
  GameTotalsRow,
  VoteItemRow,
  VoteResponseRow,
  VoteTallyRow,
} from "./supabase/types";

// A "party day" runs from 5am to 5am next day, so a session crossing midnight
// stays grouped together.
export const PARTY_CUTOFF_HOUR = 5;

export function partyDayKey(
  timestamp: Date | string | number,
  cutoffHour = PARTY_CUTOFF_HOUR,
): string {
  const d = new Date(timestamp);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function partyDayWindow(
  key: string,
  cutoffHour = PARTY_CUTOFF_HOUR,
): { startMs: number; endMs: number } {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d, cutoffHour, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, cutoffHour, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function formatPartyDay(key: string, todayKey: string): string {
  if (key === todayKey) return "Tonight";
  const { startMs } = partyDayWindow(key);
  return new Date(startMs).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function availablePartyDays(drinks: DrinkRow[]): string[] {
  const keys = new Set<string>();
  for (const d of drinks) keys.add(partyDayKey(d.logged_at));
  return [...keys].sort((a, b) => (a < b ? 1 : -1));
}

export function topDrinkLabel(drinks: DrinkRow[]): string | null {
  if (drinks.length === 0) return null;
  const counts = new Map<string, number>();
  for (const d of drinks) {
    const key = d.label ?? `${d.volume_ml}ml @ ${(d.abv * 100).toFixed(1)}%`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

export function fastestPace(drinks: DrinkRow[], windowMs = 60 * 60 * 1000): number {
  if (drinks.length === 0) return 0;
  const times = drinks
    .map((d) => new Date(d.logged_at).getTime())
    .sort((a, b) => a - b);
  let max = 0;
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > windowMs) left++;
    const count = right - left + 1;
    if (count > max) max = count;
  }
  return max;
}

export type GameWinRow = {
  user_id: string;
  wins: number;
  total: number;
};

export function gameWinsByUser(totals: GameTotalsRow[]): GameWinRow[] {
  const byUser = new Map<string, GameWinRow>();
  const byGame = new Map<string, GameTotalsRow[]>();
  for (const t of totals) {
    const row = byUser.get(t.user_id) ?? { user_id: t.user_id, wins: 0, total: 0 };
    row.total += Number(t.total_score);
    byUser.set(t.user_id, row);
    const list = byGame.get(t.game_id) ?? [];
    list.push(t);
    byGame.set(t.game_id, list);
  }
  for (const list of byGame.values()) {
    const top = [...list].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
    if (top && Number(top.total_score) > 0) {
      const row = byUser.get(top.user_id);
      if (row) row.wins += 1;
    }
  }
  return [...byUser.values()];
}

export type VoteStats = {
  cast: number;
  proposalsWon: number;
  proposalsLost: number;
};

export function voteStats(
  responses: Pick<VoteResponseRow, "user_id" | "vote_item_id">[],
  items: Pick<VoteItemRow, "id" | "proposer_id">[],
  tally: VoteTallyRow[],
  userId: string,
): VoteStats {
  const cast = responses.filter((r) => r.user_id === userId).length;
  const myProposalIds = new Set(
    items.filter((i) => i.proposer_id === userId).map((i) => i.id),
  );
  let proposalsWon = 0;
  let proposalsLost = 0;
  for (const t of tally) {
    if (!myProposalIds.has(t.id)) continue;
    if (t.net > 0) proposalsWon += 1;
    else if (t.net < 0) proposalsLost += 1;
  }
  return { cast, proposalsWon, proposalsLost };
}

export function formatClockTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
