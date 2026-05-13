"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/lib/offline-queue";

export default function OfflineBanner() {
  const { online } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  if (online || dismissed) return null;
  return (
    <button
      onClick={() => setDismissed(true)}
      className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-black text-center text-sm font-medium py-1.5"
    >
      Offline — drinks, scores, spins &amp; itinerary will sync (tap to dismiss)
    </button>
  );
}
