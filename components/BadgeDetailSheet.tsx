"use client";

import { useEffect } from "react";
import clsx from "./clsx";
import type { Achievement } from "@/lib/achievements";
import type { StoredBadge } from "@/lib/achievements-storage";
import { formatEarnedAt } from "@/lib/timeline-events";

const tierLabel: Record<Achievement["tier"], string> = {
  win: "Win",
  fail: "Fail",
  fun: "Fun",
};

const tierPill: Record<Achievement["tier"], string> = {
  win: "bg-accent text-white",
  fail: "bg-danger text-white",
  fun: "bg-ink text-bg",
};

export default function BadgeDetailSheet({
  badge,
  entries,
  onClose,
}: {
  badge: Achievement;
  entries: StoredBadge[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const got = entries.length > 0;
  const sorted = [...entries].sort((a, b) => b.earnedAtMs - a.earnedAtMs);
  const now = Date.now();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${badge.title} details`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-t-card sm:rounded-card shadow-card p-5 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden>
            {got ? badge.icon : "🔒"}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-lg leading-tight">{badge.title}</h2>
              <span
                className={clsx(
                  "text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5",
                  got ? tierPill[badge.tier] : "bg-line text-muted",
                )}
              >
                {got ? tierLabel[badge.tier] : "Locked"}
              </span>
            </div>
            <p className="text-sm text-muted mt-0.5">{badge.blurb}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full w-12 h-12 flex items-center justify-center text-lg hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            ✕
          </button>
        </div>

        {got ? (
          <div className="border-t border-line pt-3 flex flex-col gap-2">
            <div className="text-xs uppercase tracking-wide text-muted">
              Earned {entries.length} time{entries.length === 1 ? "" : "s"}
            </div>
            <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {sorted.map((e) => (
                <li key={e.dedupKey} className="text-sm flex items-center gap-2">
                  <span className="text-accent font-medium tabular-nums">
                    {formatEarnedAt(e.earnedAtMs, now)}
                  </span>
                  {e.detail && <span className="text-muted">— {e.detail}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="border-t border-line pt-3 text-sm text-muted">
            Not earned yet. {badge.timing === "endOfDay" ? "Awarded after 5am." : "Awarded live."}
          </div>
        )}
      </div>
    </div>
  );
}
