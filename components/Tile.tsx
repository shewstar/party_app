import { ReactNode } from "react";
import Link from "next/link";
import clsx from "./clsx";

export default function Tile({
  href,
  icon,
  label,
  sub,
  badge,
  className,
}: {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  badge?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "relative rounded-card border border-line bg-surface px-4 py-4 flex flex-col items-start gap-0.5",
        "shadow-card hover:bg-surface2 transition",
        className,
      )}
    >
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold text-sm">{label}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-danger text-white text-sm font-bold flex items-center justify-center tabular-nums shadow-card ring-2 ring-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
