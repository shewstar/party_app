"use client";

import { useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import clsx from "@/components/clsx";
import BadgeDetailSheet from "@/components/BadgeDetailSheet";
import {
  ACHIEVEMENTS,
  type Achievement,
} from "@/lib/achievements";
import { formatEarnedAt } from "@/lib/timeline-events";
import { useUser } from "@/lib/user-context";
import { useAllEarnedBadges } from "@/lib/achievements-tracker";
import type { StoredBadge } from "@/lib/achievements-storage";

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
      "creature-of-habit",
      "double-down",
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
  entries,
  onOpen,
}: {
  badge: Achievement;
  entries: StoredBadge[];
  onOpen: () => void;
}) {
  const got = entries.length > 0;
  // Latest is the most recent earning across all instances/nights.
  const latest = got
    ? entries.reduce((a, b) => (a.earnedAtMs >= b.earnedAtMs ? a : b))
    : undefined;
  const count = entries.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${badge.title} — ${got ? `earned ${count} time${count === 1 ? "" : "s"}` : "locked"}. Show details.`}
      className={clsx(
        "w-full text-left flex items-center gap-3 rounded-card border shadow-card px-3 py-2 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 hover:brightness-[0.98] active:brightness-95",
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
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              "font-semibold truncate text-sm",
              !got && "text-muted",
            )}
          >
            {badge.title}
          </span>
          {count > 1 && (
            <span className="shrink-0 text-xs font-semibold text-muted bg-line/50 rounded-full px-1.5 py-0.5 tabular-nums">
              ×{count}
            </span>
          )}
        </div>
        <div className="text-xs text-muted">{badge.blurb}</div>
        {latest && (
          <div className="text-xs text-accent font-medium tabular-nums">
            {formatEarnedAt(latest.earnedAtMs, Date.now())}
          </div>
        )}
      </div>
      <span
        className={clsx(
          "shrink-0 text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5",
          got ? tierPill[badge.tier] : "bg-line text-muted",
        )}
      >
        {got ? tierLabel[badge.tier] : "Locked"}
      </span>
    </button>
  );
}

export default function AchievementsPage() {
  const { user, loading } = useUser();
  const allEarned = useAllEarnedBadges();
  const [openId, setOpenId] = useState<string | null>(null);

  const entriesById = useMemo(() => {
    const map = new Map<string, StoredBadge[]>();
    for (const b of allEarned) {
      const arr = map.get(b.id) ?? [];
      arr.push(b);
      map.set(b.id, arr);
    }
    return map;
  }, [allEarned]);

  const orderedIds = useMemo(() => CATEGORIES.flatMap((c) => c.ids), []);
  const unknownIds = useMemo(
    () => ACHIEVEMENTS.filter((a) => !orderedIds.includes(a.id)).map((a) => a.id),
    [orderedIds],
  );

  if (loading || !user) {
    return (
      <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>
    );
  }

  const earnedCount = entriesById.size;
  const total = ACHIEVEMENTS.length;

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Achievements" />
      <div className="px-5 py-4 flex flex-col gap-4">
        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">
                Your badge book
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {earnedCount}
                <span className="text-muted text-base font-normal">
                  {" "}
                  / {total}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted">All-time</div>
          </div>
        </Card>

        {CATEGORIES.map((cat) => {
          const items = cat.ids
            .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
            .filter((a): a is Achievement => !!a);
          const gotInCat = items.filter((a) => entriesById.has(a.id)).length;
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
                  <Row key={a.id} badge={a} entries={entriesById.get(a.id) ?? []} onOpen={() => setOpenId(a.id)} />
                ))}
              </div>
            </section>
          );
        })}

        {openId && (() => {
          const a = ACHIEVEMENTS.find((x) => x.id === openId);
          if (!a) return null;
          return (
            <BadgeDetailSheet
              badge={a}
              entries={entriesById.get(a.id) ?? []}
              onClose={() => setOpenId(null)}
            />
          );
        })()}

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
                  <Row key={a.id} badge={a} entries={entriesById.get(a.id) ?? []} onOpen={() => setOpenId(a.id)} />
                ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
