"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUser } from "./user-context";
import { useTableData, useRealtimeReady } from "./realtime-provider";
import { partyDayKey, partyDayWindow } from "./recap";
import {
  earnedForUser,
  type AchievementCtx,
  type EarnedBadge,
} from "./achievements";
import { loadEarned, recordEarned, type StoredBadge } from "./achievements-storage";
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
} from "./supabase/types";

type TrackerCtx = {
  allEarned: StoredBadge[];
  toasts: EarnedBadge[];
  dismiss: (key: string) => void;
};

const Ctx = createContext<TrackerCtx>({
  allEarned: [],
  toasts: [],
  dismiss: () => {},
});

function playAchievementChime() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctor();
    const now = ac.currentTime;
    const notes = [
      { f: 660, t: 0 },
      { f: 880, t: 0.1 },
      { f: 1320, t: 0.2 },
    ];
    for (const n of notes) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.f, now + n.t);
      g.gain.setValueAtTime(0.0001, now + n.t);
      g.gain.exponentialRampToValueAtTime(0.2, now + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.18);
      osc.connect(g).connect(ac.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + 0.2);
    }
    setTimeout(() => ac.close().catch(() => {}), 600);
  } catch {
    // audio failure shouldn't crash anything
  }
}

type RawSources = {
  users: UserRow[];
  drinks: DrinkRow[];
  voteItems: VoteItemRow[];
  voteResponses: VoteResponseRow[];
  voteTally: VoteTallyRow[];
  games: GameRow[];
  gamePlayers: GamePlayerRow[];
  gameScores: GameScoreRow[];
  gameTotals: GameTotalsRow[];
  spins: SpinRow[];
  photos: CameraPhotoRow[];
  itineraryEvents: ItineraryEventRow[];
  itineraryReactions: ItineraryReactionRow[];
  appOpens: AppOpenRow[];
};

// Filter the raw provider data down to a single party-day window. Used by both
// the live tick (today's window) and the rollover finalizer (yesterday's window).
function buildCtxForDay(raw: RawSources, dayKey: string): AchievementCtx {
  const { startMs, endMs } = partyDayWindow(dayKey);
  const inWindow = (ts: string | null | undefined) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= startMs && t < endMs;
  };
  const windowedGames = raw.games.filter((g) => inWindow(g.created_at));
  const windowedGameIds = new Set(windowedGames.map((g) => g.id));
  const windowedEvents = raw.itineraryEvents.filter((e) => inWindow(e.created_at));
  const windowedEventIds = new Set(windowedEvents.map((e) => e.id));
  return {
    users: raw.users,
    drinks: raw.drinks.filter((d) => inWindow(d.logged_at)),
    voteItems: raw.voteItems.filter((i) => inWindow(i.created_at)),
    voteResponses: raw.voteResponses.filter((r) =>
      raw.voteItems.some((i) => i.id === r.vote_item_id && inWindow(i.created_at)),
    ),
    voteTally: raw.voteTally.filter((t) =>
      raw.voteItems.some((i) => i.id === t.id && inWindow(i.created_at)),
    ),
    games: windowedGames,
    gamePlayers: raw.gamePlayers.filter((p) => windowedGameIds.has(p.game_id)),
    gameScores: raw.gameScores.filter((s) => windowedGameIds.has(s.game_id)),
    gameTotals: raw.gameTotals.filter((t) => windowedGameIds.has(t.game_id)),
    spins: raw.spins.filter((s) => inWindow(s.created_at)),
    photos: raw.photos.filter((p) => p.party_day === dayKey),
    itineraryEvents: windowedEvents,
    itineraryReactions: raw.itineraryReactions.filter((r) =>
      windowedEventIds.has(r.event_id),
    ),
    appOpens: raw.appOpens.filter((o) => o.party_day === dayKey),
    windowStartMs: startMs,
    windowEndMs: endMs,
  };
}

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const ready = useRealtimeReady();
  const { data: _users } = useTableData<UserRow>("users");
  const { data: _drinks } = useTableData<DrinkRow>("drink_entries");
  const { data: _voteItems } = useTableData<VoteItemRow>("vote_items");
  const { data: _voteResponses } = useTableData<VoteResponseRow>("vote_responses");
  const { data: _voteTally } = useTableData<VoteTallyRow>("v_vote_tally");
  const { data: _games } = useTableData<GameRow>("games");
  const { data: _gamePlayers } = useTableData<GamePlayerRow>("game_players");
  const { data: _gameScores } = useTableData<GameScoreRow>("game_scores");
  const { data: _gameTotals } = useTableData<GameTotalsRow>("v_game_totals");
  const { data: _spins } = useTableData<SpinRow>("spins");
  const { data: _photos } = useTableData<CameraPhotoRow>("camera_photos");
  const { data: _itineraryEvents } = useTableData<ItineraryEventRow>("itinerary_events");
  const { data: _itineraryReactions } = useTableData<ItineraryReactionRow>("itinerary_reactions");
  const { data: _appOpens } = useTableData<AppOpenRow>("app_opens");

  const [toasts, setToasts] = useState<EarnedBadge[]>([]);
  const [allEarned, setAllEarned] = useState<StoredBadge[]>([]);
  const lastFinalizedDayRef = useRef<string | null>(null);

  // Hydrate from localStorage when the user is known.
  useEffect(() => {
    if (!user) return;
    setAllEarned(loadEarned(user.id));
  }, [user]);

  const raw = useMemo<RawSources>(
    () => ({
      users: _users as UserRow[],
      drinks: _drinks as DrinkRow[],
      voteItems: _voteItems as VoteItemRow[],
      voteResponses: _voteResponses as VoteResponseRow[],
      voteTally: _voteTally as VoteTallyRow[],
      games: _games as GameRow[],
      gamePlayers: _gamePlayers as GamePlayerRow[],
      gameScores: _gameScores as GameScoreRow[],
      gameTotals: _gameTotals as GameTotalsRow[],
      spins: _spins as SpinRow[],
      photos: _photos as CameraPhotoRow[],
      itineraryEvents: _itineraryEvents as ItineraryEventRow[],
      itineraryReactions: _itineraryReactions as ItineraryReactionRow[],
      appOpens: _appOpens as AppOpenRow[],
    }),
    [
      _users, _drinks, _voteItems, _voteResponses, _voteTally,
      _games, _gamePlayers, _gameScores, _gameTotals,
      _spins, _photos, _itineraryEvents, _itineraryReactions, _appOpens,
    ],
  );

  // Persist new badges as conditions become true. Runs on every source change.
  useEffect(() => {
    if (!user || !ready) return;
    const today = partyDayKey(Date.now());

    // Day rollover — finalize the previous day's end-of-day badges.
    const prev = lastFinalizedDayRef.current;
    if (prev && prev !== today) {
      const finalCtx = buildCtxForDay(raw, prev);
      const finalBadges = earnedForUser(finalCtx, user.id, "final");
      const finalized = recordEarned(user.id, finalBadges, prev);
      if (finalized.length) {
        setAllEarned(loadEarned(user.id));
      }
    }
    lastFinalizedDayRef.current = today;

    // Live: today's badges. recordEarned dedupes by composed key, so re-runs
    // are cheap and only genuinely new instances get persisted (and toasted).
    const todayCtx = buildCtxForDay(raw, today);
    const liveBadges = earnedForUser(todayCtx, user.id, "live");
    const fresh = recordEarned(user.id, liveBadges, today);
    if (fresh.length) {
      setAllEarned(loadEarned(user.id));
      // Map StoredBadge back to EarnedBadge for toast display by re-using
      // earnedForUser output (already in EarnedBadge shape).
      const freshKeys = new Set(fresh.map((f) => f.dedupKey));
      const toastBadges = liveBadges.filter(
        (b) => freshKeys.has(`${b.key}:${today}`),
      );
      if (toastBadges.length) {
        setToasts((prev) => [...prev, ...toastBadges]);
        playAchievementChime();
      }
    }
  }, [user, ready, raw]);

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((b) => b.key !== key));
  }, []);

  const value = useMemo<TrackerCtx>(
    () => ({ allEarned, toasts, dismiss }),
    [allEarned, toasts, dismiss],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAchievements() {
  return useContext(Ctx);
}

export function useAllEarnedBadges(): StoredBadge[] {
  return useContext(Ctx).allEarned;
}
