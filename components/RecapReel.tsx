"use client";

import { useEffect, useMemo, useState } from "react";
import type { CameraPhotoRow, UserRow } from "@/lib/supabase/types";
import type { EarnedBadge } from "@/lib/achievements";

const SLIDE_MS = 3000;
const MAX_SLIDES = 12;

type Stats = {
  totalDrinks: number;
  topDrinker: { name: string; count: number } | null;
  fastestPace: { name: string; pace: number } | null;
};

export default function RecapReel({
  photos,
  users,
  drinksByUserId,
  topBadges,
  stats,
  onClose,
}: {
  photos: CameraPhotoRow[];
  users: UserRow[];
  drinksByUserId: Map<string, number>;
  topBadges: EarnedBadge[];
  stats: Stats;
  onClose: () => void;
}) {
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Sample photos evenly, capped at MAX_SLIDES - 1 (last slot is the totals slide).
  const slidePhotos = useMemo(() => {
    if (photos.length === 0) return [];
    const room = MAX_SLIDES - 1;
    if (photos.length <= room) return photos;
    const step = photos.length / room;
    const out: CameraPhotoRow[] = [];
    for (let i = 0; i < room; i++) {
      out.push(photos[Math.min(photos.length - 1, Math.floor(i * step))]);
    }
    return out;
  }, [photos]);

  const total = slidePhotos.length + 1; // +1 for the totals slide at the end
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setIdx((i) => (i + 1 >= total ? i : i + 1));
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, paused, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(total - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [total, onClose]);

  const isLast = idx === total - 1;
  const photo = slidePhotos[idx];

  // Pick an overlay caption: alternate between photographer-drink-count and a top badge.
  const overlay = useMemo(() => {
    if (!photo) return null;
    if (idx % 2 === 1 && topBadges.length > 0) {
      const badge = topBadges[Math.floor(idx / 2) % topBadges.length];
      const owner = userById.get(badge.userId);
      return {
        title: `${badge.icon} ${badge.title}`,
        sub: owner ? `${owner.name} — ${badge.blurb}` : badge.blurb,
      };
    }
    const owner = userById.get(photo.user_id);
    const count = drinksByUserId.get(photo.user_id) ?? 0;
    return {
      title: owner?.name ?? "Buck",
      sub: count > 0 ? `${count} drink${count === 1 ? "" : "s"} tonight` : "On the wagon",
    };
  }, [idx, photo, topBadges, userById, drinksByUserId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Recap reel"
      onClick={() => setPaused((p) => !p)}
    >
      <div className="absolute top-0 inset-x-0 flex gap-1 p-2 z-10">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
          >
            <div
              className={
                i < idx
                  ? "h-full bg-white"
                  : i === idx
                    ? reducedMotion
                      ? "h-full bg-white/70"
                      : "h-full bg-white animate-reel-progress"
                    : "h-full bg-white/0"
              }
              style={
                i === idx && !reducedMotion
                  ? { animation: `reel-progress ${SLIDE_MS}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close recap reel"
        className="absolute top-3 right-3 z-20 rounded-full bg-white/15 text-white w-12 h-12 flex items-center justify-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        ✕
      </button>

      {!isLast && photo ? (
        <>
          <img
            src={photo.photo_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {overlay && (
            <div className="absolute bottom-0 inset-x-0 p-6 pb-10 bg-gradient-to-t from-black/85 via-black/60 to-transparent text-white">
              <div className="font-semibold text-lg leading-tight">{overlay.title}</div>
              <div className="text-sm text-white/85">{overlay.sub}</div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-8 gap-6 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold">That's a wrap</h2>
          <ul className="flex flex-col gap-3 text-base w-full max-w-xs">
            <li className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-white/70">Total drinks</span>
              <span className="font-semibold tabular-nums">{stats.totalDrinks}</span>
            </li>
            {stats.topDrinker && (
              <li className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/70">Top drinker</span>
                <span className="font-semibold">{stats.topDrinker.name}</span>
              </li>
            )}
            {stats.fastestPace && stats.fastestPace.pace > 0 && (
              <li className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/70">Fastest pace</span>
                <span className="font-semibold">
                  {stats.fastestPace.name} · {stats.fastestPace.pace}/hr
                </span>
              </li>
            )}
            {topBadges.slice(0, 3).length > 0 && (
              <li className="flex flex-col gap-1 pt-2">
                <span className="text-white/70 text-sm">Top moments</span>
                {topBadges.slice(0, 3).map((b) => (
                  <span key={b.key} className="text-sm">
                    {b.icon} {userById.get(b.userId)?.name ?? "?"} — {b.title}
                  </span>
                ))}
              </li>
            )}
          </ul>
        </div>
      )}

      <style jsx>{`
        @keyframes reel-progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-reel-progress {
          animation: reel-progress ${SLIDE_MS}ms linear forwards;
        }
      `}</style>
    </div>
  );
}
