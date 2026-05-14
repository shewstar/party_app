"use client";

import { ReactNode } from "react";
import Link from "next/link";
import clsx from "./clsx";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};

const styles = {
  primary: "bg-accent text-white shadow-card hover:opacity-95 active:opacity-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface2",
  danger: "bg-danger text-white hover:opacity-95",
};

export default function BigButton({
  children,
  onClick,
  href,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: Props) {
  const cls = clsx(
    "w-full rounded-card px-6 py-5 text-lg font-semibold transition min-h-12",
    "flex items-center justify-center gap-3",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "motion-reduce:transition-none",
    disabled && "opacity-50 cursor-not-allowed",
    styles[variant],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
