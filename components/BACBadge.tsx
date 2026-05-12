"use client";

import Link from "next/link";
import type { BacResult } from "@/lib/bac";
import { formatBAC } from "@/lib/bac";

export default function BACBadge({ result }: { result: BacResult }) {
  if (result.status === "missing_profile") {
    return (
      <div className="flex flex-col">
        <span className="text-2xl font-semibold">—</span>
        <Link href="/settings" className="text-xs text-accent underline">
          Add weight
        </Link>
        <span className="text-[11px] text-muted">est. only</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{formatBAC(result)}%</span>
      <span className="text-[11px] text-muted">estimate only</span>
    </div>
  );
}
