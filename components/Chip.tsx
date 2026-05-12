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
        "rounded-full border px-4 py-2 text-sm font-medium transition",
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
