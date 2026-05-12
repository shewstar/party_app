"use client";

import { ReactNode } from "react";
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
    "w-full rounded-card px-6 py-5 text-lg font-semibold transition",
    "flex items-center justify-center gap-3",
    disabled && "opacity-50 cursor-not-allowed",
    styles[variant],
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls} aria-disabled={disabled}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
