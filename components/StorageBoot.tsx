"use client";

import { useEffect } from "react";
import { purgeOldVersions } from "@/lib/storage";

// Run the storage-version sweep once at app start so a STORAGE_VERSION bump
// wipes any stale "v\d+:bucks:*" keys before the rest of the app reads them.
export default function StorageBoot() {
  useEffect(() => {
    purgeOldVersions();
  }, []);
  return null;
}
