"use client";

import { useEffect } from "react";
import { useAchievements } from "@/lib/achievements-tracker";
import { useHaptic } from "@/lib/haptics";
import AchievementBadge from "./AchievementBadge";

const AUTO_DISMISS_MS = 5000;

export default function AchievementToast() {
  const { toasts, dismiss } = useAchievements();
  const haptic = useHaptic();

  useEffect(() => {
    if (toasts.length === 0) return;
    haptic.success();
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.key), AUTO_DISMISS_MS),
    );
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.slice(-3).map((b) => (
        <button
          key={b.key}
          type="button"
          onClick={() => dismiss(b.key)}
          className="pointer-events-auto w-full max-w-sm text-left animate-[slideUp_0.25s_ease-out]"
          aria-label={`Dismiss ${b.title}`}
        >
          <AchievementBadge badge={b} />
        </button>
      ))}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
