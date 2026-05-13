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
import { supabase } from "./supabase/browser";
import { useUser } from "./user-context";
import { partyDayKey, partyDayWindow } from "./recap";
import { earnedForUser, type EarnedBadge } from "./achievements";
import type {
  CameraPhotoRow,
  DrinkRow,
  GamePlayerRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
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
  const [toasts, setToasts] = useState<EarnedBadge[]>([]);
  const [ready, setReady] = useState(false);
  const [dayKey, setDayKey] = useState<string>(() => partyDayKey(Date.now()));
  const seenRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
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
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const k = partyDayKey(Date.now());
    setDayKey(k);
    seenRef.current = loadSeen(user.id, k);
    pruneOldSeen(k);
    load();
    const s = supabase();
    const tables = [
      "drink_entries",
      "vote_items",
      "vote_responses",
      "games",
      "game_players",
      "game_scores",
      "spins",
      "camera_photos",
      "users",
    ];
    let ch = s.channel("achievements-tracker");
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        () => load(),
      );
    }
    ch.subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [user, load]);

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
