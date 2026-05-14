"use client";

import { useEffect, useState } from "react";

type Channel = "ls" | "db";

const listeners = new Map<Channel, Set<() => void>>();

export function notifyActivity(ch: Channel): void {
  listeners.get(ch)?.forEach((fn) => fn());
}

// Returns true while events are firing on the channel; resets to false
// `holdMs` after the last event so a burst reads as a steady glow.
export function useActivityFlash(ch: Channel, holdMs = 400): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fn = () => {
      setActive(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActive(false), holdMs);
    };
    let set = listeners.get(ch);
    if (!set) {
      set = new Set();
      listeners.set(ch, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (timer) clearTimeout(timer);
    };
  }, [ch, holdMs]);
  return active;
}
