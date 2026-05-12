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
        "relative rounded-card border border-line bg-surface px-4 py-5 flex flex-col items-start gap-1",
        "shadow-card hover:bg-surface2 transition",
        className,
      )}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold text-base">{label}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
