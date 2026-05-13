"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import { useUser } from "@/lib/user-context";
import { useTableData, useRealtimeReady } from "@/lib/realtime-provider";
import { SkeletonCard } from "@/components/Skeleton";
import { buildTimelineEvents, formatTimeAgo } from "@/lib/timeline-events";
import type {
  DrinkRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
  ItineraryEventRow,
  SpinRow,
  UserRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

export default function TimelinePage() {
  const { user, loading } = useUser();
  const ready = useRealtimeReady();
  const { data: allUsers } = useTableData<UserRow>("users");
  const { data: allDrinks } = useTableData<DrinkRow>("drink_entries");
  const { data: allVotes } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: allGames } = useTableData<GameRow>("games");
  const { data: allGameTotals } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: allGameScores } = useTableData<GameScoreRow>("game_scores");
  const { data: allSpins } = useTableData<SpinRow>("spins");
  const { data: allItinerary } = useTableData<ItineraryEventRow>("itinerary_events");

  const userById = useMemo(() => {
    const map = new Map<string, UserRow>();
    for (const u of allUsers ?? []) map.set(u.id, u);
    return map;
  }, [allUsers]);

  const events = useMemo(
    () =>
      buildTimelineEvents({
        users: allUsers ?? [],
        drinks: allDrinks ?? [],
        votes: allVotes ?? [],
        games: allGames ?? [],
        gameTotals: allGameTotals ?? [],
        gameScores: allGameScores ?? [],
        spins: allSpins ?? [],
        itinerary: allItinerary ?? [],
      }),
    [
      allUsers,
      allDrinks,
      allVotes,
      allGames,
      allGameTotals,
      allGameScores,
      allSpins,
      allItinerary,
    ],
  );

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
            i === 0 || !sameHourBucket(events[i - 1].ts, ev.ts);
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
                    {formatTimeAgo(ev.ts, now)}
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

function sameHourBucket(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate() &&
    da.getHours() === db.getHours()
  );
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
