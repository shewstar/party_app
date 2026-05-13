"use client";

import { vkey } from "./storage";
import type { EarnedBadge } from "./achievements";

export type StoredBadge = {
  id: string;
  // Composed dedup key — `${badge.key}:${partyDay}`. badge.key already
  // encodes any per-instance suffix (game id, drink id, etc.) so this is
  // unique across (badge instance, night).
  dedupKey: string;
  earnedAtMs: number;
  partyDay: string;
  detail?: string;
};

function storageKey(userId: string): string {
  return vkey(`earnedBadges:${userId}`);
}

export function loadEarned(userId: string): StoredBadge[] {
  if (typeof localStorage === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is StoredBadge =>
        b &&
        typeof b.id === "string" &&
        typeof b.dedupKey === "string" &&
        typeof b.partyDay === "string" &&
        typeof b.earnedAtMs === "number",
    );
  } catch {
    return [];
  }
}

function saveEarned(userId: string, list: StoredBadge[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch {
    // quota exceeded — ignore
  }
}

// Append any candidates whose composed key isn't already stored. Returns the
// newly-recorded subset so callers (e.g. tracker) can fire toasts only for
// genuinely new badges, not re-seen ones.
export function recordEarned(
  userId: string,
  candidates: EarnedBadge[],
  partyDay: string,
): StoredBadge[] {
  if (!userId || candidates.length === 0) return [];
  const existing = loadEarned(userId);
  const seen = new Set(existing.map((b) => b.dedupKey));
  const fresh: StoredBadge[] = [];
  for (const c of candidates) {
    const dedupKey = `${c.key}:${partyDay}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    fresh.push({
      id: c.id,
      dedupKey,
      earnedAtMs: c.earnedAtMs ?? Date.now(),
      partyDay,
      detail: c.detail,
    });
  }
  if (fresh.length === 0) return [];
  saveEarned(userId, [...existing, ...fresh]);
  return fresh;
}
