"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Chip from "@/components/Chip";
import clsx from "@/components/clsx";
import { supabase } from "@/lib/supabase/browser";
import {
  availablePartyDays,
  formatPartyDay,
  partyDayKey,
  partyDayWindow,
} from "@/lib/recap";
import {
  ACHIEVEMENTS,
  earnedForUser,
  type Achievement,
  type EarnedBadge,
} from "@/lib/achievements";
import { useUser } from "@/lib/user-context";
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

const CATEGORIES: { label: string; ids: string[] }[] = [
  {
    label: "Drinks",
    ids: [
      "quick-off-the-mark",
      "marathon-runner",
      "centurion",
      "the-beast",
      "pacesetter",
      "speed-demon",
      "strong-hand",
      "variety-pack",
      "night-owl",
      "late-starter",
      "cheers-club",
      "in-sync",
      "drinking-buddy",
      "heavyweight",
      "peak-performer",
      "iron-liver",
      "bookends",
      "light-touch",
      "pacing-yourself",
      "designated-survivor",
      "one-and-done",
    ],
  },
  {
    label: "Votes",
    ids: [
      "activist",
      "visionary",
      "landslide",
      "rule-maker",
      "democracy",
      "sad-trombone",
      "naysayer",
      "wallflower",
    ],
  },
  {
    label: "Games",
    ids: [
      "clutch",
      "triathlete",
      "gauntlet",
      "net-negative",
      "game-champion",
      "dynasty",
      "untouchable",
      "sweeper",
      "wooden-spoon",
      "bagel",
    ],
  },
  {
    label: "Spin",
    ids: [
      "chosen-one",
      "magnet",
      "four-leaf",
      "stacked-odds",
      "spinmeister",
      "ghosted",
    ],
  },
  {
    label: "Camera",
    ids: [
      "film-loaded",
      "shutterbug",
      "both-filters",
      "cool-eye",
      "warm-eye",
      "no-pic-no-proof",
    ],
  },
  {
    label: "Itinerary",
    ids: [
      "hype-buck",
      "trendsetter",
      "punctual",
      "doom-buck",
      "reaction-czar",
      "hyped-up",
    ],
  },
  {
    label: "App",
    ids: ["early-bird", "refresher", "locked-in", "last-light"],
  },
  {
    label: "Cross-feature",
    ids: [
      "renaissance-buck",
      "hot-streak",
      "triple-crown",
      "iron-man",
      "ice-cold",
      "no-show",
    ],
  },
];

const tierBorder: Record<Achievement["tier"], string> = {
  win: "border-accent/40 bg-accentSoft",
  fail: "border-danger/40 bg-danger/10",
  fun: "border-line bg-surface2",
};
const tierPill: Record<Achievement["tier"], string> = {
  win: "bg-accent text-white",
  fail: "bg-danger text-white",
  fun: "bg-ink text-bg",
};
const tierLabel: Record<Achievement["tier"], string> = {
  win: "Win",
  fail: "Fail",
  fun: "Fun",
};

function Row({
  badge,
  earned,
}: {
  badge: Achievement;
  earned: EarnedBadge | undefined;
}) {
  const got = !!earned;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-card border shadow-card px-3 py-2",
        got ? tierBorder[badge.tier] : "border-line bg-surface opacity-55",
      )}
    >
      <span
        className={clsx("shrink-0 text-2xl", !got && "grayscale")}
        aria-hidden
      >
        {got ? badge.icon : "🔒"}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={clsx(
            "font-semibold truncate text-sm",
            !got && "text-muted",
          )}
        >
          {badge.title}
        </div>
        <div className="text-xs text-muted truncate">
          {got ? earned!.detail ?? badge.blurb : badge.blurb}
        </div>
      </div>
      <span
        className={clsx(
          "shrink-0 text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5",
          got ? tierPill[badge.tier] : "bg-line text-muted",
        )}
      >
        {got ? tierLabel[badge.tier] : "Locked"}
      </span>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>
      }
    >
      <AchievementsInner />
    </Suspense>
  );
}

function AchievementsInner() {
  const { user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [drinks, setDrinks] = useState<DrinkRow[]>([]);
  const [voteItems, setVoteItems] = useState<VoteItemRow[]>([]);
  const [voteResponses, setVoteResponses] = useState<VoteResponseRow[]>([]);
  const [voteTally, setVoteTally] = useState<VoteTallyRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [gamePlayers, setGamePlayers] = useState<GamePlayerRow[]>([]);
  const [gameScores, setGameScores] = useState<GameScoreRow[]>([]);
  const [gameTotals, setGameTotals] = useState<GameTotalsRow[]>([]);
  const [spins, setSpins] = useState<SpinRow[]>([]);
  const [photos, setPhotos] = useState<CameraPhotoRow[]>([]);
  const [itineraryEvents, setItineraryEvents] = useState<ItineraryEventRow[]>([]);
  const [itineraryReactions, setItineraryReactions] = useState<ItineraryReactionRow[]>([]);
  const [appOpens, setAppOpens] = useState<AppOpenRow[]>([]);

  async function load() {
    const s = supabase();
    const [
      { data: u },
      { data: d },
      { data: vi },
      { data: vr },
      { data: vt },
      { data: gm },
      { data: gp },
      { data: gs },
      { data: gt },
      { data: sp },
      { data: ph },
      { data: ie },
      { data: ir },
      { data: ao },
    ] = await Promise.all([
      s.from("users").select("*"),
      s.from("drink_entries").select("*"),
      s.from("vote_items").select("*"),
      s.from("vote_responses").select("*"),
      s.from("v_vote_tally").select("*"),
      s.from("games").select("*"),
      s.from("game_players").select("*"),
      s.from("game_scores").select("*"),
      s.from("v_game_totals").select("*"),
      s.from("spins").select("*"),
      s.from("camera_photos").select("*"),
      s.from("itinerary_events").select("*"),
      s.from("itinerary_reactions").select("*"),
      s.from("app_opens").select("*"),
    ]);
    setUsers((u ?? []) as UserRow[]);
    setDrinks((d ?? []) as DrinkRow[]);
    setVoteItems((vi ?? []) as VoteItemRow[]);
    setVoteResponses((vr ?? []) as VoteResponseRow[]);
    setVoteTally((vt ?? []) as VoteTallyRow[]);
    setGames((gm ?? []) as GameRow[]);
    setGamePlayers((gp ?? []) as GamePlayerRow[]);
    setGameScores((gs ?? []) as GameScoreRow[]);
    setGameTotals((gt ?? []) as GameTotalsRow[]);
    setSpins((sp ?? []) as SpinRow[]);
    setPhotos((ph ?? []) as CameraPhotoRow[]);
    setItineraryEvents((ie ?? []) as ItineraryEventRow[]);
    setItineraryReactions((ir ?? []) as ItineraryReactionRow[]);
    setAppOpens((ao ?? []) as AppOpenRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel("achievements-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "spins" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camera_photos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_reactions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_opens" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading]);

  const todayKey = useMemo(() => partyDayKey(Date.now()), []);
  const selectedDay = searchParams.get("day") ?? todayKey;
  const dayWindow = useMemo(() => partyDayWindow(selectedDay), [selectedDay]);

  const dayOptions = useMemo(() => {
    const keys = new Set(availablePartyDays(drinks));
    for (const o of appOpens) keys.add(o.party_day);
    for (const p of photos) keys.add(p.party_day);
    for (const sp of spins) keys.add(partyDayKey(sp.created_at));
    for (const g of games) keys.add(partyDayKey(g.created_at));
    for (const vi of voteItems) keys.add(partyDayKey(vi.created_at));
    for (const ev of itineraryEvents) keys.add(partyDayKey(ev.created_at));
    keys.add(todayKey);
    return [...keys].sort((a, b) => (a < b ? 1 : -1));
  }, [drinks, appOpens, photos, spins, games, voteItems, itineraryEvents, todayKey]);

  const inWindow = (ts: string | null | undefined) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= dayWindow.startMs && t < dayWindow.endMs;
  };

  const achievementCtx = useMemo(() => {
    const windowedGames = games.filter((g) => inWindow(g.created_at));
    const windowedGameIds = new Set(windowedGames.map((g) => g.id));
    const windowedVoteItems = voteItems.filter((i) => inWindow(i.created_at));
    const windowedVoteIds = new Set(windowedVoteItems.map((i) => i.id));
    const windowedEvents = itineraryEvents.filter((e) => inWindow(e.created_at));
    const windowedEventIds = new Set(windowedEvents.map((e) => e.id));
    return {
      users,
      drinks: drinks.filter((d) => inWindow(d.logged_at)),
      voteItems: windowedVoteItems,
      voteResponses: voteResponses.filter((r) => windowedVoteIds.has(r.vote_item_id)),
      voteTally: voteTally.filter((t) => windowedVoteIds.has(t.id)),
      games: windowedGames,
      gamePlayers: gamePlayers.filter((p) => windowedGameIds.has(p.game_id)),
      gameScores: gameScores.filter((s) => windowedGameIds.has(s.game_id)),
      gameTotals: gameTotals.filter((t) => windowedGameIds.has(t.game_id)),
      spins: spins.filter((s) => inWindow(s.created_at)),
      photos: photos.filter((p) => p.party_day === selectedDay),
      itineraryEvents: windowedEvents,
      itineraryReactions: itineraryReactions.filter((r) =>
        windowedEventIds.has(r.event_id),
      ),
      appOpens: appOpens.filter((o) => o.party_day === selectedDay),
      windowStartMs: dayWindow.startMs,
      windowEndMs: dayWindow.endMs,
    };
  }, [
    users,
    drinks,
    voteItems,
    voteResponses,
    voteTally,
    games,
    gamePlayers,
    gameScores,
    gameTotals,
    spins,
    photos,
    itineraryEvents,
    itineraryReactions,
    appOpens,
    selectedDay,
    dayWindow.startMs,
    dayWindow.endMs,
  ]);

  const phase: "live" | "final" = selectedDay === todayKey ? "live" : "final";

  const earned = useMemo(
    () => (user ? earnedForUser(achievementCtx, user.id, phase) : []),
    [achievementCtx, user, phase],
  );

  const earnedById = useMemo(() => {
    const map = new Map<string, EarnedBadge>();
    for (const b of earned) {
      if (!map.has(b.id)) map.set(b.id, b);
    }
    return map;
  }, [earned]);

  const orderedIds = useMemo(() => CATEGORIES.flatMap((c) => c.ids), []);
  const unknownIds = useMemo(
    () => ACHIEVEMENTS.filter((a) => !orderedIds.includes(a.id)).map((a) => a.id),
    [orderedIds],
  );

  function setDay(key: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (key === todayKey) sp.delete("day");
    else sp.set("day", key);
    router.replace(`/achievements${sp.toString() ? "?" + sp.toString() : ""}`);
  }

  if (loading || !user) {
    return (
      <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>
    );
  }

  const earnedCount = earnedById.size;
  const total = ACHIEVEMENTS.length;

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Achievements" />
      <div className="px-5 py-4 flex flex-col gap-4">
        {dayOptions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((k) => (
              <Chip key={k} active={k === selectedDay} onClick={() => setDay(k)}>
                {formatPartyDay(k, todayKey)}
              </Chip>
            ))}
          </div>
        )}

        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">
                {formatPartyDay(selectedDay, todayKey)}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {earnedCount}
                <span className="text-muted text-base font-normal">
                  {" "}
                  / {total}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted">
              {phase === "live"
                ? "Live — earn end-of-night badges at 5am"
                : "Final"}
            </div>
          </div>
        </Card>

        {CATEGORIES.map((cat) => {
          const items = cat.ids
            .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
            .filter((a): a is Achievement => !!a);
          const gotInCat = items.filter((a) => earnedById.has(a.id)).length;
          return (
            <section key={cat.label} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="font-semibold text-sm uppercase tracking-wide">
                  {cat.label}
                </h2>
                <span className="text-xs text-muted tabular-nums">
                  {gotInCat} / {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((a) => (
                  <Row key={a.id} badge={a} earned={earnedById.get(a.id)} />
                ))}
              </div>
            </section>
          );
        })}

        {unknownIds.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide px-1">
              Other
            </h2>
            <div className="flex flex-col gap-2">
              {unknownIds
                .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
                .filter((a): a is Achievement => !!a)
                .map((a) => (
                  <Row key={a.id} badge={a} earned={earnedById.get(a.id)} />
                ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
