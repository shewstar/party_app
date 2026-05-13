import clsx from "./clsx";
import type { EarnedBadge, Tier } from "@/lib/achievements";

const tierStyles: Record<Tier, string> = {
  win: "border-accent/40 bg-accentSoft text-ink",
  fail: "border-danger/40 bg-danger/10 text-ink",
  fun: "border-line bg-surface2 text-ink",
};

const tierLabel: Record<Tier, string> = {
  win: "Win",
  fail: "Fail",
  fun: "Fun",
};

export default function AchievementBadge({
  badge,
  size = "md",
}: {
  badge: EarnedBadge;
  size?: "sm" | "md";
}) {
  const compact = size === "sm";
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-card border shadow-card",
        compact ? "px-3 py-2" : "px-4 py-3",
        tierStyles[badge.tier],
      )}
    >
      <span className={clsx("shrink-0", compact ? "text-xl" : "text-2xl")} aria-hidden>
        {badge.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={clsx("font-semibold truncate", compact ? "text-sm" : "text-base")}>
          {badge.title}
        </div>
        <div className={clsx("text-muted truncate", compact ? "text-xs" : "text-sm")}>
          {badge.detail ?? badge.blurb}
        </div>
      </div>
      <span
        className={clsx(
          "shrink-0 text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5",
          badge.tier === "win" && "bg-accent text-white",
          badge.tier === "fail" && "bg-danger text-white",
          badge.tier === "fun" && "bg-ink text-bg",
        )}
      >
        {tierLabel[badge.tier]}
      </span>
    </div>
  );
}
