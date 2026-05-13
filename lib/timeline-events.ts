import type {
  DrinkRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
  ItineraryEventRow,
  SpinRow,
  UserRow,
  VoteTallyRow,
} from "./supabase/types";

export type TimelineEvent = {
  key: string;
  icon: string;
  text: string;
  ts: number;
  userId: string | null;
};

export const CATEGORY_EMOJI: Record<string, string> = {
  beer: "🍺",
  wine: "🍷",
  spirits: "🥃",
};

type BuildInput = {
  users: UserRow[];
  drinks: DrinkRow[];
  votes: VoteTallyRow[];
  games: GameRow[];
  gameTotals: GameTotalsRow[];
  gameScores: GameScoreRow[];
  spins: SpinRow[];
  itinerary: ItineraryEventRow[];
};

export function buildTimelineEvents(input: BuildInput): TimelineEvent[] {
  const userById = new Map<string, UserRow>();
  for (const u of input.users) userById.set(u.id, u);

  const list: TimelineEvent[] = [];

  for (const d of input.drinks) {
    const u = userById.get(d.user_id);
    list.push({
      key: `drink-${d.id}`,
      icon: CATEGORY_EMOJI[d.category] ?? "🍺",
      text: `${u?.name ?? "Someone"} logged a ${d.label ?? d.category}`,
      ts: new Date(d.logged_at).getTime(),
      userId: d.user_id,
    });
  }

  for (const v of input.votes) {
    const u = v.proposer_id ? userById.get(v.proposer_id) : null;
    const status = v.net > 0 ? ` (+${v.net})` : v.net < 0 ? ` (${v.net})` : "";
    list.push({
      key: `vote-${v.id}`,
      icon: "🗳️",
      text: `${u?.name ?? "Someone"} proposed: "${v.text}"${status}`,
      ts: new Date(v.created_at).getTime(),
      userId: v.proposer_id,
    });
  }

  // Game wins. Use the latest score timestamp as "won at" so long-running games
  // land at the right place chronologically; fall back to created_at otherwise.
  const totalsByGame = new Map<string, GameTotalsRow[]>();
  for (const t of input.gameTotals) {
    const arr = totalsByGame.get(t.game_id) ?? [];
    arr.push(t);
    totalsByGame.set(t.game_id, arr);
  }
  const gameById = new Map<string, GameRow>();
  for (const g of input.games) gameById.set(g.id, g);
  const lastScoreAtByGame = new Map<string, number>();
  for (const sc of input.gameScores) {
    const t = new Date(sc.recorded_at).getTime();
    const prev = lastScoreAtByGame.get(sc.game_id) ?? 0;
    if (t > prev) lastScoreAtByGame.set(sc.game_id, t);
  }
  for (const [gameId, rows] of totalsByGame) {
    const game = gameById.get(gameId);
    if (!game || !game.finished) continue;
    const winner = [...rows].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
    if (winner) {
      const u = userById.get(winner.user_id);
      list.push({
        key: `game-won-${gameId}`,
        icon: "🏆",
        text: `${u?.name ?? "Someone"} won ${game.name}`,
        ts: lastScoreAtByGame.get(gameId) ?? new Date(game.created_at).getTime(),
        userId: winner.user_id,
      });
    }
  }

  for (const s of input.spins) {
    const spinner = s.spinner_id ? userById.get(s.spinner_id) : null;
    const winner = userById.get(s.winner_id);
    list.push({
      key: `spin-${s.id}`,
      icon: "🎰",
      text: `${spinner?.name ?? "Someone"} spun → ${winner?.name ?? "Someone"}`,
      ts: new Date(s.created_at).getTime(),
      userId: s.spinner_id,
    });
  }

  for (const ev of input.itinerary) {
    const u = ev.created_by ? userById.get(ev.created_by) : null;
    list.push({
      key: `itinerary-${ev.id}`,
      icon: "📋",
      text: `New: ${ev.title}${u ? ` (${u.name})` : ""}`,
      ts: new Date(ev.created_at ?? 0).getTime(),
      userId: ev.created_by,
    });
  }

  list.sort((a, b) => b.ts - a.ts);
  return list;
}

export function formatTimeAgo(ts: number, now: number): string {
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
