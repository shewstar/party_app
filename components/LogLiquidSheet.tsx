"use client";

import { useEffect } from "react";
import BigButton from "./BigButton";

export default function LogLiquidSheet({
  onClose,
  onAddDrink,
  onLogPiss,
  pissPending,
}: {
  onClose: () => void;
  onAddDrink: () => void;
  onLogPiss: () => void | Promise<void>;
  pissPending: boolean;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
      aria-label="Log a liquid"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-t-card sm:rounded-card shadow-card p-5 flex flex-col gap-3"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg">Log a liquid</h2>
            <p className="text-sm text-muted">In or out?</p>
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

        <BigButton onClick={onAddDrink} className="py-5">
          <span className="text-2xl mr-1" aria-hidden>🍺</span>
          <span>Add a drink</span>
        </BigButton>

        <BigButton onClick={onLogPiss} variant="secondary" disabled={pissPending} className="py-5">
          <span className="text-2xl mr-1" aria-hidden>🚽</span>
          <span>{pissPending ? "Logging…" : "Log a piss"}</span>
        </BigButton>
      </div>
    </div>
  );
}
