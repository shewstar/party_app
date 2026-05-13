"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Chip from "@/components/Chip";
import Avatar from "@/components/Avatar";
import BigButton from "@/components/BigButton";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import AchievementBadge from "@/components/AchievementBadge";
import { supabase } from "@/lib/supabase/browser";
import { peakBAC, formatBAC } from "@/lib/bac";
import {
  availablePartyDays,
  fastestPace,
  formatClockTime,
  formatPartyDay,
  gameWinsByUser,
  partyDayKey,
  partyDayWindow,
  topDrinkLabel,
  voteStats,
} from "@/lib/recap";
import { ACHIEVEMENTS, evaluateAchievements, type Achievement, type EarnedBadge } from "@/lib/achievements";
import { useAllEarnedBadges } from "@/lib/achievements-tracker";
import type { StoredBadge } from "@/lib/achievements-storage";
import { useUser } from "@/lib/user-context";
import { SkeletonCard } from "@/components/Skeleton";
import { useTableData } from "@/lib/realtime-provider";
import type {
  AppOpenRow,
  CameraPhotoRow,
  DrinkRow,
  GamePlayerRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
  ItineraryEventRow,
  ItineraryReactionRow,
  SpinRow,
  UserRow,
  VoteItemRow,
  VoteResponseRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

export default function RecapPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex flex-col">
          <TopBar title="Recap" />
          <div className="px-5 pb-4 flex flex-col gap-4 flex-1">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={1} />
          </div>
        </main>
      }
    >
      <RecapPageInner />
    </Suspense>
  );
}

function RecapPageInner() {
  const { user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: users } = useTableData<UserRow>("users");
  const { data: drinks } = useTableData<DrinkRow>("drink_entries");
  const { data: games } = useTableData<GameRow>("games");
  const { data: gameTotals } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: gamePlayers } = useTableData<GamePlayerRow>("game_players");
  const { data: gameScores } = useTableData<GameScoreRow>("game_scores");
  const { data: voteItems } = useTableData<VoteItemRow>("vote_items");
  const { data: voteResponses } = useTableData<VoteResponseRow>("vote_responses");
  const { data: voteTally } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: spins } = useTableData<SpinRow>("spins");
  const { data: photos } = useTableData<CameraPhotoRow>("camera_photos");
  const { data: itineraryEvents } = useTableData<ItineraryEventRow>("itinerary_events");
  const { data: itineraryReactions } = useTableData<ItineraryReactionRow>("itinerary_reactions");
  const { data: appOpens } = useTableData<AppOpenRow>("app_opens");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const todayKey = useMemo(() => partyDayKey(Date.now()), []);
  const selectedDay = searchParams.get("day") ?? todayKey;
  const dayWindow = useMemo(() => partyDayWindow(selectedDay), [selectedDay]);

  const dayOptions = useMemo(() => {
    const keys = availablePartyDays(drinks);
    if (!keys.includes(todayKey)) keys.unshift(todayKey);
    return keys.sort((a, b) => (a < b ? 1 : -1));
  }, [drinks, todayKey]);

  const inWindow = (ts: string | null | undefined) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= dayWindow.startMs && t < dayWindow.endMs;
  };

  const windowedDrinks = useMemo(
    () => drinks.filter((d) => inWindow(d.logged_at)),
    [drinks, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedVoteItems = useMemo(
    () => voteItems.filter((i) => inWindow(i.created_at)),
    [voteItems, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedVoteIds = useMemo(
    () => new Set(windowedVoteItems.map((i) => i.id)),
    [windowedVoteItems],
  );
  const windowedVoteResponses = useMemo(
    () => voteResponses.filter((r) => inWindow(r.updated_at) && windowedVoteIds.has(r.vote_item_id)),
    [voteResponses, dayWindow.startMs, dayWindow.endMs, windowedVoteIds],
  );
  const windowedVoteTally = useMemo(
    () => voteTally.filter((t) => windowedVoteIds.has(t.id)),
    [voteTally, windowedVoteIds],
  );
  const windowedGames = useMemo(
    () => games.filter((gm) => inWindow(gm.created_at)),
    [games, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedGameIds = useMemo(
    () => new Set(windowedGames.map((gm) => gm.id)),
    [windowedGames],
  );
  const windowedGameTotals = useMemo(
    () => gameTotals.filter((t) => windowedGameIds.has(t.game_id)),
    [gameTotals, windowedGameIds],
  );
  const windowedGamePlayers = useMemo(
    () => gamePlayers.filter((p) => windowedGameIds.has(p.game_id)),
    [gamePlayers, windowedGameIds],
  );
  const windowedGameScores = useMemo(
    () => gameScores.filter((s) => windowedGameIds.has(s.game_id)),
    [gameScores, windowedGameIds],
  );
  const windowedSpins = useMemo(
    () => spins.filter((s) => inWindow(s.created_at)),
    [spins, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedPhotos = useMemo(
    () => photos
      .filter((p) => p.party_day === selectedDay)
      .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()),
    [photos, selectedDay],
  );
  const windowedItineraryEvents = useMemo(
    () => itineraryEvents.filter((e) => inWindow(e.created_at)),
    [itineraryEvents, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedItineraryReactions = useMemo(() => {
    const ids = new Set(windowedItineraryEvents.map((e) => e.id));
    return itineraryReactions.filter((r) => ids.has(r.event_id));
  }, [itineraryReactions, windowedItineraryEvents]);
  const windowedAppOpens = useMemo(
    () => appOpens.filter((o) => o.party_day === selectedDay),
    [appOpens, selectedDay],
  );

  const achievementCtx = useMemo(
    () => ({
      users,
      drinks: windowedDrinks,
      voteItems: windowedVoteItems,
      voteResponses: windowedVoteResponses,
      voteTally: windowedVoteTally,
      games: windowedGames,
      gamePlayers: windowedGamePlayers,
      gameScores: windowedGameScores,
      gameTotals: windowedGameTotals,
      spins: windowedSpins,
      photos: windowedPhotos,
      itineraryEvents: windowedItineraryEvents,
      itineraryReactions: windowedItineraryReactions,
      appOpens: windowedAppOpens,
      windowStartMs: dayWindow.startMs,
      windowEndMs: dayWindow.endMs,
    }),
    [
      users,
      windowedDrinks,
      windowedVoteItems,
      windowedVoteResponses,
      windowedVoteTally,
      windowedGames,
      windowedGamePlayers,
      windowedGameScores,
      windowedGameTotals,
      windowedSpins,
      windowedPhotos,
      windowedItineraryEvents,
      windowedItineraryReactions,
      windowedAppOpens,
      dayWindow.startMs,
      dayWindow.endMs,
    ],
  );

  const phase: "live" | "final" = selectedDay === todayKey ? "live" : "final";

  // Your badges for this night come from the persistence layer (so they
  // survive re-evaluation flicker and the 5am rollover). Other users' badges
  // for the same night are still computed live since their history isn't on
  // this device.
  const allEarned = useAllEarnedBadges();
  const myBadges = useMemo(
    () => (user ? allEarned.filter((b) => b.partyDay === selectedDay) : []),
    [allEarned, user, selectedDay],
  );
  const myBadgeGroups = useMemo(() => groupByBadgeId(myBadges), [myBadges]);

  const allBadges = useMemo(
    () => evaluateAchievements(achievementCtx, phase),
    [achievementCtx, phase],
  );

  const myDrinks = useMemo(
    () => (user ? windowedDrinks.filter((d) => d.user_id === user.id) : []),
    [windowedDrinks, user],
  );

  const personal = useMemo(() => {
    if (!user) return null;
    const totalStd = myDrinks.reduce((s, d) => s + Number(d.standard_drinks), 0);
    const sessionStart =
      myDrinks.length > 0
        ? Math.min(...myDrinks.map((d) => new Date(d.logged_at).getTime()))
        : undefined;
    const peak = peakBAC(user, myDrinks, sessionStart);
    const top = topDrinkLabel(myDrinks);
    const votes = voteStats(
      windowedVoteResponses,
      windowedVoteItems,
      windowedVoteTally,
      user.id,
    );
    const wins = gameWinsByUser(windowedGameTotals).find((r) => r.user_id === user.id);
    return {
      count: myDrinks.length,
      std: totalStd,
      peak,
      top,
      votes,
      wins: wins?.wins ?? 0,
    };
  }, [
    user,
    myDrinks,
    windowedVoteResponses,
    windowedVoteItems,
    windowedVoteTally,
    windowedGameTotals,
  ]);

  const superlatives = useMemo(() => {
    const userById = new Map(users.map((u) => [u.id, u]));

    const stdByUser = new Map<string, number>();
    for (const d of windowedDrinks) {
      stdByUser.set(d.user_id, (stdByUser.get(d.user_id) ?? 0) + Number(d.standard_drinks));
    }
    const biggestDrinker = [...stdByUser.entries()].sort((a, b) => b[1] - a[1])[0];

    let highestPeak: { userId: string; value: number } | null = null;
    for (const u of users) {
      const uDrinks = windowedDrinks.filter((d) => d.user_id === u.id);
      if (uDrinks.length === 0) continue;
      const sessionStart = Math.min(...uDrinks.map((d) => new Date(d.logged_at).getTime()));
      const p = peakBAC(u, uDrinks, sessionStart);
      if (p.status === "ok" && (!highestPeak || p.value > highestPeak.value)) {
        highestPeak = { userId: u.id, value: p.value };
      }
    }

    let fastest: { userId: string; pace: number } | null = null;
    for (const u of users) {
      const pace = fastestPace(windowedDrinks.filter((d) => d.user_id === u.id));
      if (!fastest || pace > fastest.pace) {
        fastest = { userId: u.id, pace };
      }
    }

    const wonByProposer = new Map<string, number>();
    const proposerById = new Map(windowedVoteItems.map((i) => [i.id, i.proposer_id]));
    for (const t of windowedVoteTally) {
      if (t.net <= 0) continue;
      const proposer = proposerById.get(t.id);
      if (!proposer) continue;
      wonByProposer.set(proposer, (wonByProposer.get(proposer) ?? 0) + 1);
    }
    const topProposer = [...wonByProposer.entries()].sort((a, b) => b[1] - a[1])[0];

    const wins = gameWinsByUser(windowedGameTotals).sort(
      (a, b) => b.wins - a.wins || b.total - a.total,
    );
    const champion = wins[0];

    return {
      biggestDrinker:
        biggestDrinker && biggestDrinker[1] > 0
          ? { user: userById.get(biggestDrinker[0]), value: biggestDrinker[1] }
          : null,
      highestPeak:
        highestPeak && highestPeak.value > 0
          ? { user: userById.get(highestPeak.userId), value: highestPeak.value }
          : null,
      fastest:
        fastest && fastest.pace > 0
          ? { user: userById.get(fastest.userId), value: fastest.pace }
          : null,
      topProposer: topProposer
        ? { user: userById.get(topProposer[0]), value: topProposer[1] }
        : null,
      champion:
        champion && champion.wins > 0
          ? { user: userById.get(champion.user_id), value: champion.wins }
          : null,
    };
  }, [users, windowedDrinks, windowedVoteItems, windowedVoteTally, windowedGameTotals]);

  const buckStats = useMemo(() => {
    const buck = users.find((u) => u.is_buck);
    if (!buck) return null;
    const buckDrinks = windowedDrinks.filter((d) => d.user_id === buck.id);
    const totalStd = buckDrinks.reduce((s, d) => s + Number(d.standard_drinks), 0);
    const sessionStart =
      buckDrinks.length > 0
        ? Math.min(...buckDrinks.map((d) => new Date(d.logged_at).getTime()))
        : undefined;
    const peak = peakBAC(buck, buckDrinks, sessionStart);
    const wins = gameWinsByUser(windowedGameTotals).find((r) => r.user_id === buck.id);
    return { buck, count: buckDrinks.length, std: totalStd, peak, winCount: wins?.wins ?? 0 };
  }, [users, windowedDrinks, windowedGameTotals]);

  function buildShareText(): string {
    if (!user || !personal) return "";
    const dayLabel = formatPartyDay(selectedDay, todayKey);
    const lines = [
      `🏁 ${user.name}'s bucks recap — ${dayLabel}`,
      `🍺 ${personal.count} drinks (${personal.std.toFixed(1)} standard)`,
    ];
    if (personal.peak.status === "ok" && personal.peak.atMs) {
      lines.push(
        `📈 Peak BAC: ${personal.peak.value.toFixed(3)} at ${formatClockTime(personal.peak.atMs)}`,
      );
    }
    if (personal.top) lines.push(`🥇 Top drink: ${personal.top}`);
    lines.push(
      `🗳️ Voted: ${personal.votes.cast} cast / ${personal.votes.proposalsWon} won / ${personal.votes.proposalsLost} lost`,
    );
    lines.push(`🏆 Game wins: ${personal.wins}`);
    if (myBadgeGroups.length > 0) {
      const top = myBadgeGroups.slice(0, 3).map((g) => {
        const x = g.entries.length > 1 ? ` ×${g.entries.length}` : "";
        return `${g.achievement.icon} ${g.achievement.title}${x}`;
      });
      lines.push(`— ${top.join(" · ")}`);
    }
    return lines.join("\n");
  }

  async function onShare() {
    const text = buildShareText();
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator).share({ text });
        setShareStatus(null);
        return;
      }
    } catch {
      // user cancelled — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Copied to clipboard");
    } catch {
      setShareStatus("Couldn't share — copy manually");
    }
  }

  function selectDay(key: string) {
    if (key === todayKey) {
      router.replace("/recap");
    } else {
      router.replace(`/recap?day=${key}`);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Recap" />
        <div className="px-5 pb-4 flex flex-col gap-4 flex-1">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={1} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={3} />
        </div>
      </main>
    );
  }

  const isEmpty = windowedDrinks.length === 0;

  const userById = new Map(users.map((u) => [u.id, u]));
  const myBadgesByTier = {
    win: myBadgeGroups.filter((g) => g.achievement.tier === "win"),
    fail: myBadgeGroups.filter((g) => g.achievement.tier === "fail"),
    fun: myBadgeGroups.filter((g) => g.achievement.tier === "fun"),
  };
  const myBadgeIds = new Set(myBadgeGroups.map((g) => g.achievement.id));
  // Dedupe users per badge — per-trigger badges (in-sync, double-down, etc.)
  // emit one EarnedBadge per occurrence, so the same user can appear many
  // times for the same badge id within `allBadges`.
  const otherBadgesById = new Map<string, { badge: typeof allBadges[number]; users: UserRow[]; seen: Set<string> }>();
  for (const b of allBadges) {
    if (b.userId === user?.id) continue;
    if (myBadgeIds.has(b.id)) continue;
    const u = userById.get(b.userId);
    if (!u) continue;
    const entry = otherBadgesById.get(b.id);
    if (entry) {
      if (!entry.seen.has(u.id)) {
        entry.seen.add(u.id);
        entry.users.push(u);
      }
    } else {
      otherBadgesById.set(b.id, { badge: b, users: [u], seen: new Set([u.id]) });
    }
  }
  const otherBadgeRows = [...otherBadgesById.values()].sort((a, b) =>
    a.badge.tier === b.badge.tier ? 0 : a.badge.tier === "win" ? -1 : 1,
  );

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Recap" />
      {dayOptions.length > 1 && (
        <div className="px-5 py-2 flex gap-2 overflow-x-auto">
          {dayOptions.map((key) => (
            <Chip
              key={key}
              active={key === selectedDay}
              onClick={() => selectDay(key)}
              className="whitespace-nowrap"
            >
              {formatPartyDay(key, todayKey)}
            </Chip>
          ))}
        </div>
      )}
      <div className="px-5 pb-4 flex flex-col gap-4 flex-1">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={user.name} url={user.avatar_url} size={40} isBuck={user.is_buck} />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">
                {formatPartyDay(selectedDay, todayKey)}
              </div>
              <div className="font-semibold">{user.name}</div>
            </div>
          </div>
          {personal && (
            <ul className="flex flex-col gap-3">
              <StatRow label="Drinks" value={`${personal.count}`} sub={`${personal.std.toFixed(1)} std`} />
              <StatRow
                label="Peak BAC"
                value={
                  personal.peak.status === "ok" && personal.peak.value > 0
                    ? personal.peak.value.toFixed(3)
                    : formatBAC(personal.peak)
                }
                sub={
                  personal.peak.status === "ok" && personal.peak.atMs
                    ? `at ${formatClockTime(personal.peak.atMs)}`
                    : undefined
                }
              />
              <StatRow label="Top drink" value={personal.top ?? "—"} />
              <StatRow
                label="Votes"
                value={`${personal.votes.cast} cast`}
                sub={`${personal.votes.proposalsWon} won · ${personal.votes.proposalsLost} lost`}
              />
              <StatRow label="Game wins" value={`${personal.wins}`} />
            </ul>
          )}
        </Card>

        {buckStats && (
          <Card>
            <h2 className="font-semibold mb-1">👑 Buck's Night</h2>
            <p className="text-xs text-muted mb-3">{buckStats.buck.name}</p>
            <ul className="flex flex-col gap-3">
              <StatRow label="Drinks" value={`${buckStats.count}`} sub={`${buckStats.std.toFixed(1)} std`} />
              <StatRow
                label="Peak BAC"
                value={
                  buckStats.peak.status === "ok" && buckStats.peak.value > 0
                    ? buckStats.peak.value.toFixed(3)
                    : formatBAC(buckStats.peak)
                }
                sub={
                  buckStats.peak.status === "ok" && buckStats.peak.atMs
                    ? `at ${formatClockTime(buckStats.peak.atMs)}`
                    : undefined
                }
              />
              <StatRow label="Game wins" value={`${buckStats.winCount}`} />
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold mb-1">Your achievements</h2>
          {phase === "live" ? (
            <p className="text-xs text-muted mb-3">
              End-of-night badges reveal after 5am.
            </p>
          ) : (
            <p className="text-xs text-muted mb-3">
              {myBadgeGroups.length === 0
                ? "No badges earned this night."
                : `${myBadgeGroups.length} badge${myBadgeGroups.length === 1 ? "" : "s"} earned.`}
            </p>
          )}
          {myBadgeGroups.length === 0 ? (
            <p className="text-sm text-muted">
              Quiet night so far — get amongst it.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {(["win", "fun", "fail"] as const).map((tier) => {
                const list = myBadgesByTier[tier];
                if (list.length === 0) return null;
                const label = tier === "win" ? "Wins" : tier === "fail" ? "Fails" : "Fun";
                return (
                  <div key={tier} className="flex flex-col gap-2">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {label}
                    </div>
                    {list.map((g) => (
                      <AchievementBadge
                        key={g.achievement.id}
                        badge={storedToEarned(g.achievement, g.entries, user?.id ?? "")}
                        count={g.entries.length}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Party superlatives</h2>
          {isEmpty ? (
            <p className="text-sm text-muted">Nothing logged for this night.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              <SuperRow
                icon="🍺"
                label="Biggest drinker"
                user={superlatives.biggestDrinker?.user}
                value={
                  superlatives.biggestDrinker
                    ? `${superlatives.biggestDrinker.value.toFixed(1)} std`
                    : "—"
                }
              />
              <SuperRow
                icon="📈"
                label="Highest BAC"
                user={superlatives.highestPeak?.user}
                value={
                  superlatives.highestPeak
                    ? superlatives.highestPeak.value.toFixed(3)
                    : "—"
                }
              />
              <SuperRow
                icon="⚡"
                label="Fastest pace"
                user={superlatives.fastest?.user}
                value={superlatives.fastest ? `${superlatives.fastest.value}/hr` : "—"}
              />
              <SuperRow
                icon="🗳️"
                label="Most votes won"
                user={superlatives.topProposer?.user}
                value={
                  superlatives.topProposer ? `${superlatives.topProposer.value}` : "—"
                }
              />
              <SuperRow
                icon="🏆"
                label="Game champion"
                user={superlatives.champion?.user}
                value={superlatives.champion ? `${superlatives.champion.value} W` : "—"}
              />
            </ul>
          )}
        </Card>

        {otherBadgeRows.length > 0 && (
          <Card>
            <h2 className="font-semibold mb-3">Badges around the room</h2>
            <ul className="flex flex-col gap-3">
              {otherBadgeRows.map(({ badge, users: us }) => (
                <li key={badge.id} className="flex items-center gap-3">
                  <span className="text-xl shrink-0" aria-hidden>
                    {badge.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{badge.title}</div>
                    <div className="text-xs text-muted truncate">{badge.blurb}</div>
                  </div>
                  <div className="flex -space-x-2">
                    {(() => {
                      // Belt-and-suspenders: dedup right at the render site
                      // in case anything upstream produces duplicate users.
                      const uniq = Array.from(new Map(us.map((u) => [u.id, u])).values());
                      return (
                        <>
                          {uniq.slice(0, 4).map((u) => (
                            <Avatar key={u.id} name={u.name} url={u.avatar_url} size={24} isBuck={u.is_buck} />
                          ))}
                          {uniq.length > 4 && (
                            <span className="text-xs text-muted ml-1 self-center">
                              +{uniq.length - 4}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold mb-3">
            {phase === "live" ? "Tonight's roll" : "Photo roll"}
          </h2>
          {phase === "live" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                🎞 Tonight's roll develops at 5am.
              </p>
              <Link href="/camera" className="text-sm text-accent underline self-start">
                Open camera →
              </Link>
            </div>
          ) : windowedPhotos.length === 0 ? (
            <p className="text-sm text-muted">No photos developed for this night.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {windowedPhotos.map((p, i) => {
                const photographer = userById.get(p.user_id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setLightboxIdx(i)}
                    className="relative rounded-card overflow-hidden border border-line bg-surface shadow-card"
                  >
                    <img
                      src={p.photo_url}
                      alt=""
                      loading="lazy"
                      className="w-full aspect-square object-cover"
                    />
                    {photographer && (
                      <div className="absolute bottom-1 left-1 right-1 flex items-center gap-2 bg-black/55 text-white rounded-full px-2 py-1">
                        <Avatar
                          name={photographer.name}
                          url={photographer.avatar_url}
                          size={20}
                          isBuck={photographer.is_buck}
                        />
                        <span className="text-xs truncate">{photographer.name}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {lightboxIdx !== null && windowedPhotos[lightboxIdx] && (
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center p-4"
            aria-label="Close photo"
          >
            <img
              src={windowedPhotos[lightboxIdx].photo_url}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </button>
        )}

        <BigButton onClick={onShare} className="py-5 text-lg">
          📣 Share recap
        </BigButton>
        {shareStatus && (
          <div className="text-center text-sm text-muted">{shareStatus}</div>
        )}
      </div>
      <DisclaimerFooter />
    </main>
  );
}

type BadgeGroup = { achievement: Achievement; entries: StoredBadge[] };

const ACHIEVEMENT_BY_ID = new Map<string, Achievement>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

function groupByBadgeId(entries: StoredBadge[]): BadgeGroup[] {
  const groups = new Map<string, BadgeGroup>();
  for (const e of entries) {
    const achievement = ACHIEVEMENT_BY_ID.get(e.id);
    if (!achievement) continue;
    const g = groups.get(e.id);
    if (g) g.entries.push(e);
    else groups.set(e.id, { achievement, entries: [e] });
  }
  return [...groups.values()];
}

function storedToEarned(achievement: Achievement, entries: StoredBadge[], userId: string): EarnedBadge {
  const latest = entries.reduce((a, b) => (a.earnedAtMs >= b.earnedAtMs ? a : b));
  return {
    ...achievement,
    userId,
    key: latest.dedupKey,
    detail: latest.detail,
    earnedAtMs: latest.earnedAtMs,
  };
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted tabular-nums">{sub}</span>}
      </span>
    </li>
  );
}

function SuperRow({
  icon,
  label,
  user,
  value,
}: {
  icon: string;
  label: string;
  user: UserRow | undefined;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted">{label}</div>
        <div className="flex items-center gap-2 min-w-0">
          {user && <Avatar name={user.name} url={user.avatar_url} size={24} isBuck={user.is_buck} />}
          <span className="font-medium truncate">{user?.name ?? "—"}</span>
        </div>
      </div>
      <span className="tabular-nums font-semibold">{value}</span>
    </li>
  );
}
