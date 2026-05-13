"use client";

import { useCallback, useEffect, useState } from "react";

type QueuedWrite = {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  ts: number;
  attempts: number;
};

const QUEUE_KEY = "bucksOfflineQueue";
const MAX_ITEMS = 50;
const MAX_ATTEMPTS = 5;
const DEDUP_WINDOW_MS = 2000;

function loadQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate legacy entries written before the schema added id/attempts.
    return parsed.map((it) => ({
      id: typeof it.id === "string" ? it.id : crypto.randomUUID(),
      table: String(it.table),
      payload: it.payload ?? {},
      ts: Number(it.ts) || Date.now(),
      attempts: Number(it.attempts) || 0,
    }));
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

let drainPromise: Promise<void> = Promise.resolve();

export function drainOfflineQueue(
  insertFn: (table: string, payload: Record<string, unknown>) => Promise<boolean>,
): Promise<void> {
  // Chain onto any in-flight drain so concurrent reconnect signals serialize
  // instead of racing — a boolean flag wouldn't be safe across awaits.
  drainPromise = drainPromise.then(async () => {
    const q = loadQueue();
    if (q.length === 0) return;
    const remaining: QueuedWrite[] = [];
    for (const item of q) {
      const ok = await insertFn(item.table, item.payload);
      if (ok) continue;
      const next = { ...item, attempts: item.attempts + 1 };
      if (next.attempts < MAX_ATTEMPTS) remaining.push(next);
    }
    saveQueue(remaining);
  });
  return drainPromise;
}

export function enqueueWrite(table: string, payload: Record<string, unknown>) {
  const q = loadQueue();
  const now = Date.now();
  const payloadKey = JSON.stringify(payload);
  // Drop accidental dupes (e.g. button double-tap) within a short window.
  const dup = q.some(
    (it) =>
      it.table === table &&
      now - it.ts < DEDUP_WINDOW_MS &&
      JSON.stringify(it.payload) === payloadKey,
  );
  if (dup) return;
  q.push({ id: crypto.randomUUID(), table, payload, ts: now, attempts: 0 });
  saveQueue(q);
}

export function pendingCount(): number {
  if (typeof localStorage === "undefined") return 0;
  return loadQueue().length;
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
