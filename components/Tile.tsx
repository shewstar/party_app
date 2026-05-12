import { ReactNode } from "react";
import Link from "next/link";
import clsx from "./clsx";

export default function Tile({
  href,
  icon,
  label,
  sub,
  className,
}: {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-card border border-line bg-surface px-4 py-5 flex flex-col items-start gap-1",
        "shadow-card hover:bg-surface2 transition",
        className,
      )}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold text-base">{label}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </Link>
  );
}
