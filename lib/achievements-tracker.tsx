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
import { earnedForUser, type EarnedBadge } from "./achievements";
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
  liveEarned: EarnedBadge[];
  toasts: EarnedBadge[];
  dismiss: (key: string) => void;
};

const Ctx = createContext<TrackerCtx>({
  liveEarned: [],
  toasts: [],
  dismiss: () => {},
});

const SEEN_KEY_PREFIX = "seenBadges";

function seenStorageKey(userId: string, dayKey: string) {
  return `${SEEN_KEY_PREFIX}:${userId}:${dayKey}`;
}

function loadSeen(userId: string, dayKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenStorageKey(userId, dayKey));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(userId: string, dayKey: string, seen: Set<string>) {
  try {
    localStorage.setItem(seenStorageKey(userId, dayKey), JSON.stringify([...seen]));
  } catch {
    // ignore quota / SSR
  }
}

function pruneOldSeen(currentDayKey: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${SEEN_KEY_PREFIX}:`)) continue;
      const day = k.split(":")[2];
      if (day && day < currentDayKey) {
        // Keep only the most recent 7 days to allow same-night replay across midnight.
        const dt = new Date(currentDayKey).getTime();
        const od = new Date(day).getTime();
        if (!Number.isNaN(dt) && !Number.isNaN(od) && dt - od > 7 * 86_400_000) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch {
    // ignore
  }
}

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
  const [dayKey, setDayKey] = useState<string>(() => partyDayKey(Date.now()));
  const seenRef = useRef<Set<string>>(new Set());

  const users = (_users ?? []) as UserRow[];
  const drinks = (_drinks ?? []) as DrinkRow[];
  const voteItems = (_voteItems ?? []) as VoteItemRow[];
  const voteResponses = (_voteResponses ?? []) as VoteResponseRow[];
  const voteTally = (_voteTally ?? []) as VoteTallyRow[];
  const games = (_games ?? []) as GameRow[];
  const gamePlayers = (_gamePlayers ?? []) as GamePlayerRow[];
  const gameScores = (_gameScores ?? []) as GameScoreRow[];
  const gameTotals = (_gameTotals ?? []) as GameTotalsRow[];
  const spins = (_spins ?? []) as SpinRow[];
  const photos = (_photos ?? []) as CameraPhotoRow[];
  const itineraryEvents = (_itineraryEvents ?? []) as ItineraryEventRow[];
  const itineraryReactions = (_itineraryReactions ?? []) as ItineraryReactionRow[];
  const appOpens = (_appOpens ?? []) as AppOpenRow[];

  useEffect(() => {
    if (!user) return;
    const k = partyDayKey(Date.now());
    setDayKey(k);
    seenRef.current = loadSeen(user.id, k);
    pruneOldSeen(k);
  }, [user]);

  const window = useMemo(() => partyDayWindow(dayKey), [dayKey]);

  const ctx = useMemo(
    () => {
      const inWindow = (ts: string | null | undefined) => {
        if (!ts) return false;
        const t = new Date(ts).getTime();
        return t >= window.startMs && t < window.endMs;
      };
      const windowedGameIds = new Set(
        games.filter((g) => inWindow(g.created_at)).map((g) => g.id),
      );
      const windowedEvents = itineraryEvents.filter((e) =>
        inWindow(e.created_at),
      );
      const windowedEventIds = new Set(windowedEvents.map((e) => e.id));
      return {
        users,
        drinks: drinks.filter((d) => inWindow(d.logged_at)),
        voteItems: voteItems.filter((i) => inWindow(i.created_at)),
        voteResponses: voteResponses.filter((r) =>
          voteItems.some(
            (i) => i.id === r.vote_item_id && inWindow(i.created_at),
          ),
        ),
        voteTally: voteTally.filter((t) =>
          voteItems.some(
            (i) => i.id === t.id && inWindow(i.created_at),
          ),
        ),
        games: games.filter((g) => inWindow(g.created_at)),
        gamePlayers: gamePlayers.filter((p) => windowedGameIds.has(p.game_id)),
        gameScores: gameScores.filter((s) => windowedGameIds.has(s.game_id)),
        gameTotals: gameTotals.filter((t) => windowedGameIds.has(t.game_id)),
        spins: spins.filter((s) => inWindow(s.created_at)),
        photos: photos.filter((p) => p.party_day === dayKey),
        itineraryEvents: windowedEvents,
        itineraryReactions: itineraryReactions.filter((r) =>
          windowedEventIds.has(r.event_id),
        ),
        appOpens: appOpens.filter((o) => o.party_day === dayKey),
        windowStartMs: window.startMs,
        windowEndMs: window.endMs,
      };
    },
    [
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
      window.startMs,
      window.endMs,
      dayKey,
    ],
  );

  const liveEarned = useMemo(
    () => (user ? earnedForUser(ctx, user.id, "live") : []),
    [ctx, user],
  );

  useEffect(() => {
    if (!user || !ready) return;
    const seen = seenRef.current;
    const fresh = liveEarned.filter((b) => !seen.has(b.key));
    if (fresh.length === 0) return;
    for (const b of fresh) seen.add(b.key);
    saveSeen(user.id, dayKey, seen);
    setToasts((prev) => [...prev, ...fresh]);
    playAchievementChime();
  }, [liveEarned, user, ready, dayKey]);

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((b) => b.key !== key));
  }, []);

  const value = useMemo<TrackerCtx>(
    () => ({ liveEarned, toasts, dismiss }),
    [liveEarned, toasts, dismiss],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAchievements() {
  return useContext(Ctx);
}
