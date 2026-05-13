"use client";

import { useCallback, useEffect, useState } from "react";

type QueuedWrite = {
  table: string;
  payload: Record<string, unknown>;
  ts: number;
};

const QUEUE_KEY = "bucksOfflineQueue";
const MAX_ITEMS = 50;

function loadQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedWrite[];
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedWrite[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_ITEMS)));
  } catch {
    // quota exceeded — oldest entries already trimmed
  }
}

let drainBusy = false;

export async function drainOfflineQueue(
  insertFn: (table: string, payload: Record<string, unknown>) => Promise<boolean>,
) {
  if (drainBusy) return;
  drainBusy = true;
  const q = loadQueue();
  if (q.length === 0) { drainBusy = false; return; }
  const remaining: QueuedWrite[] = [];
  for (const item of q) {
    const ok = await insertFn(item.table, item.payload);
    if (!ok) remaining.push(item);
  }
  saveQueue(remaining);
  drainBusy = false;
}

export function enqueueWrite(table: string, payload: Record<string, unknown>) {
  const q = loadQueue();
  q.push({ table, payload, ts: Date.now() });
  saveQueue(q);
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setMounted(true);
    const goOnline = () => {
      setOnline(true);
      drainOfflineQueue(async (table, payload) => {
        try {
          const { supabase } = await import("@/lib/supabase/browser");
          const { error } = await supabase().from(table).insert(payload);
          return !error;
        } catch {
          return false;
        }
      });
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const enqueue = useCallback((table: string, payload: Record<string, unknown>) => {
    if (online) return false;
    enqueueWrite(table, payload);
    return true;
  }, [online]);

  return { online: mounted ? online : true, enqueue };
}
