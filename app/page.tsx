"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BigButton from "@/components/BigButton";
import Card from "@/components/Card";
import Tile from "@/components/Tile";
import Avatar from "@/components/Avatar";
import BACBadge from "@/components/BACBadge";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import { SkeletonAvatar, SkeletonCard, SkeletonLine, SkeletonTile } from "@/components/Skeleton";
import { estimateBAC } from "@/lib/bac";
import { useUser } from "@/lib/user-context";
import { useTableData } from "@/lib/realtime-provider";
import { useOnlineStatus } from "@/lib/offline-queue";
import { partyDayKey } from "@/lib/recap";
import { buildTimelineEvents, formatTimeAgo } from "@/lib/timeline-events";
import type {
  DrinkRow,
  DrinksLeaderboardRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
  ItineraryEventRow,
  SpinRow,
  UserRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

const CAMERA_DAILY_LIMIT = 3;

const DrinkBoardRow = memo(function DrinkBoardRow({
  rank, name, avatarUrl, isBuck, drinkCount,
}: {
  rank: number; name: string; avatarUrl: string | null;
  isBuck: boolean; drinkCount: number;
}) {
  return (
    <li className={`flex items-center gap-3 rounded-lg ${isBuck ? "bg-amber-50/50 -mx-2 px-2 py-1" : ""}`}>
      <span className="w-5 text-muted text-sm tabular-nums">{rank}</span>
      <Avatar name={name} url={avatarUrl} size={32} isBuck={isBuck} />
      <span className="flex-1 font-medium">{name}</span>
      <span className="tabular-nums font-semibold">{drinkCount}</span>
    </li>
  );
});

function timeSince(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomePage() {
  const { user, loading } = useUser();
  const { online } = useOnlineStatus();

  const { data: allDrinks } = useTableData<DrinkRow>("drink_entries");
  const { data: leaderboard } = useTableData<DrinksLeaderboardRow>("v_drinks_leaderboard");
  const { data: tally } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: allVoteItems } = useTableData<{ id: string }>("vote_items");
  const { data: allVoteResponses } = useTableData<{ vote_item_id: string; user_id: string }>("vote_responses");
  const { data: allPhotos } = useTableData<{ id: string; user_id: string; party_day: string }>("camera_photos");
  const { data: allUsers } = useTableData<UserRow>("users");
  const { data: allGames } = useTableData<GameRow>("games");
  const { data: allGameTotals } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: allGameScores } = useTableData<GameScoreRow>("game_scores");
  const { data: allSpins } = useTableData<SpinRow>("spins");
  const { data: allItinerary } = useTableData<ItineraryEventRow>("itinerary_events");

  const todayKey = partyDayKey(Date.now());

  const myDrinks = useMemo(
    () => (allDrinks as DrinkRow[]).filter((d) => d.user_id === user?.id),
    [allDrinks, user],
  );

  const board = useMemo(
    () => [...(leaderboard as DrinksLeaderboardRow[])]
      .sort((a, b) => b.drink_count - a.drink_count)
      .slice(0, 5),
    [leaderboard],
  );

  const forItems = useMemo(
    () => (tally as VoteTallyRow[]).filter((v) => v.for_count > 0)
      .sort((a, b) => b.net - a.net),
    [tally],
  );

  const newVoteCount = useMemo(() => {
    const voted = new Set(
      (allVoteResponses as { vote_item_id: string; user_id: string }[])
        .filter((r) => r.user_id === user?.id)
        .map((r) => r.vote_item_id),
    );
    return (allVoteItems as { id: string }[]).filter((v) => !voted.has(v.id)).length;
  }, [allVoteItems, allVoteResponses, user]);

  const cameraUsed = useMemo(
    () => (allPhotos as { user_id: string; party_day: string }[])
      .filter((p) => p.user_id === user?.id && p.party_day === todayKey).length,
    [allPhotos, user, todayKey],
  );

  const userCount = (allUsers as UserRow[]).length;

  const buckUser = useMemo(
    () => (allUsers as UserRow[]).find((u) => u.is_buck) ?? null,
    [allUsers],
  );

  const buckDrinks = useMemo(
    () => buckUser
      ? (allDrinks as DrinkRow[]).filter((d) => d.user_id === buckUser.id)
      : [],
    [allDrinks, buckUser],
  );

  const bac = useMemo(
    () => (user ? estimateBAC(user, myDrinks) : { status: "missing_profile" as const }),
    [user, myDrinks],
  );

  const buckBac = useMemo(
    () => (buckUser ? estimateBAC(buckUser, buckDrinks) : null),
    [buckUser, buckDrinks],
  );

  const latestEvent = useMemo(() => {
    const events = buildTimelineEvents({
      users: (allUsers as UserRow[]) ?? [],
      drinks: (allDrinks as DrinkRow[]) ?? [],
      votes: (tally as VoteTallyRow[]) ?? [],
      games: (allGames as GameRow[]) ?? [],
      gameTotals: (allGameTotals as GameTotalsRow[]) ?? [],
      gameScores: (allGameScores as GameScoreRow[]) ?? [],
      spins: (allSpins as SpinRow[]) ?? [],
      itinerary: (allItinerary as ItineraryEventRow[]) ?? [],
    });
    return events[0] ?? null;
  }, [allUsers, allDrinks, tally, allGames, allGameTotals, allGameScores, allSpins, allItinerary]);

  if (loading || !user) {
    return (
      <main className="flex-1 px-5 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size={44} />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine width="w-10" height="h-3" />
            <SkeletonLine width="w-24" height="h-5" />
          </div>
        </div>
        <SkeletonCard rows={2} className="grid grid-cols-2 gap-4" />
        <div className="bg-surface border border-line rounded-card py-7" />
        <SkeletonCard rows={1} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
        <SkeletonCard rows={2} />
        <SkeletonCard rows={5} />
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} url={user.avatar_url} size={44} isBuck={user.is_buck} />
          <div>
            <div className="text-sm text-muted">Hey</div>
            <div className="text-lg font-semibold">{user.name}</div>
          </div>
        </div>
        <Link href="/settings" className="text-sm text-muted underline flex items-center gap-1.5">
          Settings
          <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-amber-500"}`} aria-label={online ? "Online" : "Offline"} />
        </Link>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Drinks</div>
            <div className="text-3xl font-bold tabular-nums">{myDrinks.length}</div>
            <div className="text-xs text-muted">
              {myDrinks
                .reduce((s, d) => s + Number(d.standard_drinks), 0)
                .toFixed(1)}{" "}
              std
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Est. BAC</div>
            <BACBadge result={bac} />
          </div>
        </div>
      </Card>

      <Link
        href="/timeline"
        className="bg-surface border border-line rounded-card shadow-card px-4 py-3 flex items-center gap-3"
      >
        <span className="text-2xl" aria-hidden>
          {latestEvent?.icon ?? "📜"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted flex items-center gap-2">
            <span>Latest</span>
            {latestEvent && (
              <span className="tabular-nums normal-case tracking-normal">
                · {formatTimeAgo(latestEvent.ts, Date.now())}
              </span>
            )}
          </div>
          <div className="font-semibold truncate">
            {latestEvent?.text ?? "Nothing yet — get the party started"}
          </div>
        </div>
        <span className="text-muted text-sm">→</span>
      </Link>

      <BigButton href="/drink" className="py-7 text-2xl">
        ➕ Add a Drink
      </BigButton>

      {buckUser && (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">👑</span>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted">Buck Watch</h2>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={buckUser.name} url={buckUser.avatar_url} size={48} isBuck />
              <div className="flex flex-col gap-0.5">
                <div className="font-semibold text-lg">{buckUser.name}</div>
                <div className="text-sm text-muted">
                  <span className="tabular-nums">{buckDrinks.length}</span> drinks ·
                  <span className="tabular-nums"> {buckDrinks.reduce((s, d) => s + Number(d.standard_drinks), 0).toFixed(1)}</span> std ·
                  <span className="tabular-nums"> {buckBac?.status === "ok" ? `${buckBac.value.toFixed(3)}%` : "—"}</span> BAC
                </div>
                <div className="text-xs text-muted">
                  ⏱ Last drink: <span className="tabular-nums">{buckDrinks.length > 0 ? timeSince(buckDrinks[0].logged_at) : "none"}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/vote" icon="🗳️" label="Vote" sub="Propose rules" badge={newVoteCount} />
        <Tile href="/itinerary" icon="📋" label="Itinerary" sub="What's happening" />
        <Tile href="/games" icon="🎯" label="Games" sub="Score it" />
        <Tile
          href="/camera"
          icon="📷"
          label="Camera"
          sub={
            cameraUsed >= CAMERA_DAILY_LIMIT
              ? "No film left — develops at 5am"
              : `${CAMERA_DAILY_LIMIT - cameraUsed} shot${CAMERA_DAILY_LIMIT - cameraUsed === 1 ? "" : "s"} left today`
          }
        />
        <Tile href="/spin" icon="🎰" label="Spin" sub="Pick someone" />
        <Tile href="/recap" icon="🏁" label="Recap" sub="End-of-night stats" />
        <Tile href="/leaderboards" icon="🏆" label="Leaderboards" sub="Who's winning" />
        <Tile href="/achievements" icon="🏅" label="Achievements" sub="Your badge book" />
      </div>

      {(() => {
        const majorityItems = forItems.filter((v) => v.for_count > userCount / 2);
        return (
          <Card>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-semibold">Democratic Direction</h2>
              <Link href="/vote" className="text-sm text-accent">
                Vote →
              </Link>
            </div>
            {majorityItems.length === 0 ? (
              <p className="text-sm text-muted">Nothing has been voted in yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {majorityItems.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 border border-line rounded-card px-3 py-2 bg-surface2"
                  >
                    <span className="text-sm">{v.text}</span>
                    <span className="text-xs text-accent font-semibold tabular-nums">
                      +{v.net}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })()}

      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Drinks leaderboard</h2>
          <Link href="/leaderboards" className="text-sm text-accent">
            View all →
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {board.length === 0 && <li className="text-sm text-muted">No drinks yet.</li>}
          {board.map((row, i) => (
            <DrinkBoardRow
              key={row.id}
              rank={i + 1}
              name={row.name}
              avatarUrl={row.avatar_url}
              isBuck={row.is_buck}
              drinkCount={row.drink_count}
            />
          ))}
        </ul>
      </Card>

      <DisclaimerFooter />
    </main>
  );
}
