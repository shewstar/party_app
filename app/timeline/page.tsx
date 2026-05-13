"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import { useUser } from "@/lib/user-context";
import { useTableData } from "@/lib/realtime-provider";
import { useRealtimeReady } from "@/lib/realtime-provider";
import { SkeletonCard } from "@/components/Skeleton";
import type {
  DrinkRow,
  GameRow,
  GameTotalsRow,
  ItineraryEventRow,
  SpinRow,
  UserRow,
  VoteItemRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

type TimelineEvent = {
  key: string;
  icon: string;
  text: string;
  ts: number;
  userId: string | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  beer: "\uD83C\uDF7A",
  wine: "\uD83C\uDF77",
  spirits: "\uD83E\uDD43",
};

export default function TimelinePage() {
  const { user, loading } = useUser();
  const ready = useRealtimeReady();
  const { data: allUsers } = useTableData<UserRow>("users");
  const { data: allDrinks } = useTableData<DrinkRow>("drink_entries");
  const { data: allVotes } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: allGames } = useTableData<GameRow>("games");
  const { data: allGameTotals } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: allSpins } = useTableData<SpinRow>("spins");
  const { data: allItinerary } = useTableData<ItineraryEventRow>("itinerary_events");

  const users = (allUsers ?? []) as UserRow[];
  const userById = useMemo(() => {
    const map = new Map<string, UserRow>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // Drinks
    for (const d of (allDrinks ?? []) as DrinkRow[]) {
      const u = userById.get(d.user_id);
      const emoji = CATEGORY_EMOJI[d.category] ?? "\uD83C\uDF7A";
      list.push({
        key: `drink-${d.id}`,
        icon: emoji,
        text: `${u?.name ?? "Someone"} logged a ${d.label ?? d.category}`,
        ts: new Date(d.logged_at).getTime(),
        userId: d.user_id,
      });
    }

    // Vote proposals
    for (const v of (allVotes ?? []) as VoteTallyRow[]) {
      const u = v.proposer_id ? userById.get(v.proposer_id) : null;
      const status = v.net > 0 ? ` (+${v.net})` : v.net < 0 ? ` (${v.net})` : "";
      list.push({
        key: `vote-${v.id}`,
        icon: "\uD83D\uDDF3\uFE0F",
        text: `${u?.name ?? "Someone"} proposed: "${v.text}"${status}`,
        ts: new Date(v.created_at).getTime(),
        userId: v.proposer_id,
      });
    }

    // Games — wins
    const gameTotals = (allGameTotals ?? []) as GameTotalsRow[];
    const totalsByGame = new Map<string, GameTotalsRow[]>();
    for (const t of gameTotals) {
      const list = totalsByGame.get(t.game_id) ?? [];
      list.push(t);
      totalsByGame.set(t.game_id, list);
    }
    const gameById = new Map<string, GameRow>();
    for (const g of (allGames ?? []) as GameRow[]) gameById.set(g.id, g);

    for (const [gameId, rows] of totalsByGame) {
      const game = gameById.get(gameId);
      if (!game || !game.finished) continue;
      const winner = [...rows].sort((a, b) => Number(b.total_score) - Number(a.total_score))[0];
      if (winner) {
        const u = userById.get(winner.user_id);
        list.push({
          key: `game-won-${gameId}`,
          icon: "\uD83C\uDFC6",
          text: `${u?.name ?? "Someone"} won ${game.name}`,
          ts: new Date(game.created_at).getTime(),
          userId: winner.user_id,
        });
      }
    }

    // Spins
    for (const s of (allSpins ?? []) as SpinRow[]) {
      const spinner = s.spinner_id ? userById.get(s.spinner_id) : null;
      const winner = userById.get(s.winner_id);
      list.push({
        key: `spin-${s.id}`,
        icon: "\uD83C\uDFB0",
        text: `${spinner?.name ?? "Someone"} spun \u2192 ${winner?.name ?? "Someone"}`,
        ts: new Date(s.created_at).getTime(),
        userId: s.spinner_id,
      });
    }

    // Itinerary events
    for (const ev of ((allItinerary ?? []) as ItineraryEventRow[])) {
      const u = ev.created_by ? userById.get(ev.created_by) : null;
      list.push({
        key: `itinerary-${ev.id}`,
        icon: "\uD83D\uDCCB",
        text: `New: ${ev.title}${u ? ` (${u.name})` : ""}`,
        ts: new Date(ev.created_at ?? 0).getTime(),
        userId: ev.created_by,
      });
    }

    list.sort((a, b) => b.ts - a.ts);
    return list;
  }, [allDrinks, allVotes, allGames, allGameTotals, allSpins, allItinerary, userById]);

  if (loading || !user || !ready) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Timeline" />
        <div className="px-5 py-4 flex flex-col gap-3">
          <SkeletonCard rows={4} />
        </div>
      </main>
    );
  }

  const now = Date.now();

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Timeline" />
      <div className="px-5 pb-4 flex flex-col gap-3">
        {events.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            Nothing has happened yet. Get the party started.
          </p>
        )}
        {events.map((ev, i) => {
          const showHeader =
            i === 0 ||
            new Date(events[i - 1].ts).getHours() !==
              new Date(ev.ts).getHours();
          const u = ev.userId ? userById.get(ev.userId) : null;
          return (
            <div key={ev.key}>
              {showHeader && (
                <div className="text-xs uppercase tracking-wide text-muted font-semibold mb-2 mt-2">
                  {formatHour(ev.ts, now)}
                </div>
              )}
              <div className="flex items-start gap-3 py-1.5 border-b border-line/50 last:border-0">
                <span className="text-lg shrink-0 pt-0.5" aria-hidden>
                  {ev.icon}
                </span>
                {u && (
                  <Avatar
                    name={u.name}
                    url={u.avatar_url}
                    size={28}
                    isBuck={u.is_buck}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{ev.text}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatTime(ev.ts, now)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function formatTime(ts: number, now: number): string {
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatHour(ts: number, now: number): string {
  const d = new Date(ts);
  const today = new Date(now);
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return isToday ? time : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}
