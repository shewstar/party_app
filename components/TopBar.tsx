"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "./clsx";

export default function TopBar({
  title,
  back = true,
  className,
}: {
  title: string;
  back?: boolean;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={clsx(
        "flex items-center gap-3 px-4 pt-4 pb-3 sticky top-0 bg-bg/95 backdrop-blur z-10",
        className,
      )}
    >
      {back && (
        <button
          onClick={() => router.back()}
          className="rounded-full border border-line bg-surface w-12 h-12 flex items-center justify-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-label="Back"
        >
          ←
        </button>
      )}
      <h1 className="text-xl font-semibold flex-1">{title}</h1>
      <Link href="/" className="text-sm text-muted">
        Home
      </Link>
    </header>
  );
}
