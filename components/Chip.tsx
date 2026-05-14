"use client";

import { ReactNode } from "react";
import clsx from "./clsx";

export default function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm font-medium transition min-h-12",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        "motion-reduce:transition-none",
        active
          ? "bg-accent text-white border-accent"
          : "bg-surface text-ink border-line hover:bg-surface2",
        className,
      )}
    >
      {children}
    </button>
  );
}
