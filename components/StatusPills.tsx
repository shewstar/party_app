"use client";

import { useOnlineStatus } from "@/lib/offline-queue";
import { useActivityFlash } from "@/lib/activity-bus";

export default function StatusPills() {
  const { online } = useOnlineStatus();
  const lsActive = useActivityFlash("ls");
  const dbActive = useActivityFlash("db");

  const base =
    "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`${base} ${online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
        aria-label={online ? "Online" : "Offline"}
      >
        {online ? "Online" : "Offline"}
      </span>
      <span
        className={`${base} ${lsActive ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-400"}`}
        aria-label={lsActive ? "Local storage active" : "Local storage idle"}
      >
        LS
      </span>
      <span
        className={`${base} ${dbActive ? "bg-purple-100 text-purple-700" : "bg-neutral-100 text-neutral-400"}`}
        aria-label={dbActive ? "Database active" : "Database idle"}
      >
        DB
      </span>
    </div>
  );
}
