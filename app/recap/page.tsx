"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Chip from "@/components/Chip";
import Avatar from "@/components/Avatar";
import BigButton from "@/components/BigButton";
import DisclaimerFooter from "@/components/DisclaimerFooter";
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
import { useUser } from "@/lib/user-context";
import type {
  DrinkRow,
  GameRow,
  GameTotalsRow,
  UserRow,
  VoteItemRow,
  VoteResponseRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

export default function RecapPage() {
  return (
    <Suspense
      fallback={<main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>}
    >
      <RecapPageInner />
    </Suspense>
  );
}

function RecapPageInner() {
  const { user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [drinks, setDrinks] = useState<DrinkRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [gameTotals, setGameTotals] = useState<GameTotalsRow[]>([]);
  const [voteItems, setVoteItems] = useState<VoteItemRow[]>([]);
  const [voteResponses, setVoteResponses] = useState<VoteResponseRow[]>([]);
  const [voteTally, setVoteTally] = useState<VoteTallyRow[]>([]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function load() {
    const s = supabase();
    const [
      { data: u },
      { data: d },
      { data: gm },
      { data: g },
      { data: vi },
      { data: vr },
      { data: vt },
    ] = await Promise.all([
      s.from("users").select("*"),
      s.from("drink_entries").select("*"),
      s.from("games").select("*"),
      s.from("v_game_totals").select("*"),
      s.from("vote_items").select("*"),
      s.from("vote_responses").select("*"),
      s.from("v_vote_tally").select("*"),
    ]);
    setUsers((u ?? []) as UserRow[]);
    setDrinks((d ?? []) as DrinkRow[]);
    setGames((gm ?? []) as GameRow[]);
    setGameTotals((g ?? []) as GameTotalsRow[]);
    setVoteItems((vi ?? []) as VoteItemRow[]);
    setVoteResponses((vr ?? []) as VoteResponseRow[]);
    setVoteTally((vt ?? []) as VoteTallyRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel("recap")
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading]);

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
  const windowedGameIds = useMemo(
    () => new Set(games.filter((gm) => inWindow(gm.created_at)).map((gm) => gm.id)),
    [games, dayWindow.startMs, dayWindow.endMs],
  );
  const windowedGameTotals = useMemo(
    () => gameTotals.filter((t) => windowedGameIds.has(t.game_id)),
    [gameTotals, windowedGameIds],
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
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  const isEmpty = windowedDrinks.length === 0;

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
            <Avatar name={user.name} url={user.avatar_url} size={40} />
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
          {user && <Avatar name={user.name} url={user.avatar_url} size={24} />}
          <span className="font-medium truncate">{user?.name ?? "—"}</span>
        </div>
      </div>
      <span className="tabular-nums font-semibold">{value}</span>
    </li>
  );
}
