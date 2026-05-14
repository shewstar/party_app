"use client";

import { useEffect } from "react";
import { purgeOldVersions } from "@/lib/storage";
import { installActivityTracker } from "@/lib/activity-tracker";

// Install at module load (no-ops on the server) so initial localStorage and
// fetch calls — which fire before any useEffect runs — are still tracked.
installActivityTracker();

// Run the storage-version sweep once at app start so a STORAGE_VERSION bump
// wipes any stale "v\d+:bucks:*" keys before the rest of the app reads them.
export default function StorageBoot() {
  useEffect(() => {
    purgeOldVersions();
  }, []);
  return null;
}
