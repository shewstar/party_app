"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BigButton from "@/components/BigButton";
import Card from "@/components/Card";
import Tile from "@/components/Tile";
import Avatar from "@/components/Avatar";
import BACBadge from "@/components/BACBadge";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import { supabase } from "@/lib/supabase/browser";
import { estimateBAC } from "@/lib/bac";
import { useUser } from "@/lib/user-context";
import { useAchievements } from "@/lib/achievements-tracker";
import { partyDayKey } from "@/lib/recap";
import type { DrinkRow, DrinksLeaderboardRow, UserRow, VoteTallyRow } from "@/lib/supabase/types";

const CAMERA_DAILY_LIMIT = 3;

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
  const { liveEarned } = useAchievements();
  const [myDrinks, setMyDrinks] = useState<DrinkRow[]>([]);
  const [board, setBoard] = useState<DrinksLeaderboardRow[]>([]);
  const [forItems, setForItems] = useState<VoteTallyRow[]>([]);
  const [newVoteCount, setNewVoteCount] = useState(0);
  const [cameraUsed, setCameraUsed] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [buckUser, setBuckUser] = useState<UserRow | null>(null);
  const [buckDrinks, setBuckDrinks] = useState<DrinkRow[]>([]);

  async function loadAll(uid?: string) {
    const s = supabase();
    const todayKey = partyDayKey(Date.now());
    const [
      { data: drinks },
      { data: lb },
      { data: tally },
      { data: voteIds },
      { data: myResponses },
      cameraCount,
      usersCount,
      { data: buck },
    ] = await Promise.all([
      uid
        ? s.from("drink_entries").select("*").eq("user_id", uid).order("logged_at", { ascending: false })
        : Promise.resolve({ data: [] as DrinkRow[] }),
      s.from("v_drinks_leaderboard").select("*").order("drink_count", { ascending: false }).limit(5),
      s.from("v_vote_tally").select("*").gt("for_count", 0).order("net", { ascending: false }),
      s.from("vote_items").select("id"),
      uid
        ? s.from("vote_responses").select("vote_item_id").eq("user_id", uid)
        : Promise.resolve({ data: [] as { vote_item_id: string }[] }),
      uid
        ? s
            .from("camera_photos")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .eq("party_day", todayKey)
        : Promise.resolve({ count: 0 as number | null }),
      s.from("users").select("id", { count: "exact", head: true }),
      s.from("users").select("*").eq("is_buck", true).maybeSingle(),
    ]);
    setMyDrinks((drinks ?? []) as DrinkRow[]);
    setBoard((lb ?? []) as DrinksLeaderboardRow[]);
    setForItems((tally ?? []) as VoteTallyRow[]);
    const voted = new Set(
      ((myResponses ?? []) as { vote_item_id: string }[]).map((r) => r.vote_item_id),
    );
    const unvoted = ((voteIds ?? []) as { id: string }[]).filter((v) => !voted.has(v.id)).length;
    setNewVoteCount(unvoted);
    setCameraUsed(cameraCount.count ?? 0);
    setUserCount(usersCount.count ?? 0);

    const b = (buck ?? null) as UserRow | null;
    setBuckUser(b);
    if (b) {
      const { data: bd } = await s.from("drink_entries").select("*").eq("user_id", b.id).order("logged_at", { ascending: false });
      setBuckDrinks((bd ?? []) as DrinkRow[]);
    } else {
      setBuckDrinks([]);
    }
  }

  useEffect(() => {
    if (loading) return;
    loadAll(user?.id);
    const s = supabase();
    const ch = s
      .channel("home")
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_entries" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_items" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () =>
        loadAll(user?.id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "camera_photos" }, () =>
        loadAll(user?.id),
      )
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading, user?.id]);

  const bac = useMemo(
    () => (user ? estimateBAC(user, myDrinks) : { status: "missing_profile" as const }),
    [user, myDrinks],
  );

  const buckBac = useMemo(
    () => (buckUser ? estimateBAC(buckUser, buckDrinks) : null),
    [buckUser, buckDrinks],
  );

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
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
        <Link href="/settings" className="text-sm text-muted underline">
          Settings
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
        href="/achievements"
        className="bg-surface border border-line rounded-card shadow-card px-4 py-3 flex items-center gap-3"
      >
        <span className="text-2xl" aria-hidden>
          {liveEarned[liveEarned.length - 1]?.icon ?? "🎖"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted">
            Tonight's achievements
          </div>
          <div className="font-semibold truncate">
            {liveEarned.length === 0
              ? "None yet — get into it"
              : liveEarned.length === 1
                ? liveEarned[0].title
                : `${liveEarned.length} earned · latest: ${liveEarned[liveEarned.length - 1].title}`}
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
        <Tile href="/games" icon="🎯" label="Games" sub="Score it" />
        <Tile href="/leaderboards" icon="🏆" label="Leaderboards" sub="Who's winning" />
        <Tile href="/vote" icon="🗳️" label="Vote" sub="Propose rules" badge={newVoteCount} />
        <Tile href="/itinerary" icon="📋" label="Itinerary" sub="What's happening" />
        <Tile href="/spin" icon="🎰" label="Spin" sub="Pick someone" />
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
        <Tile href="/recap" icon="🏁" label="Recap" sub="End-of-night stats" />
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
            <li key={row.id} className={`flex items-center gap-3 rounded-lg ${row.is_buck ? "bg-amber-50/50 -mx-2 px-2 py-1" : ""}`}>
              <span className="w-5 text-muted text-sm tabular-nums">{i + 1}</span>
              <Avatar name={row.name} url={row.avatar_url} size={32} isBuck={row.is_buck} />
              <span className="flex-1 font-medium">{row.name}</span>
              <span className="tabular-nums font-semibold">{row.drink_count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <DisclaimerFooter />
    </main>
  );
}
