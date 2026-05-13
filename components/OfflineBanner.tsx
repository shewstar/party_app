"use client";

import { useOnlineStatus } from "@/lib/offline-queue";

export default function OfflineBanner() {
  const { online } = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-black text-center text-sm font-medium py-1.5">
      Offline — changes queued
    </div>
  );
}
