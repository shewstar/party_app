// Versioned localStorage namespace.
//
// Bump STORAGE_VERSION to wipe every device on next page load: purgeOldVersions()
// (mounted via <StorageBoot/> in app/layout.tsx) removes any "v\d+:bucks:..."
// key that isn't on the current version. All consumers see empty state and
// the app behaves as if first launch (incl. fresh userId).
//
// Process: edit the constant, commit, deploy. No notification, no manual
// action. Use this between events / before a fresh party night.

export const STORAGE_VERSION = 2;
const PREFIX = "bucks";

export function vkey(rawKey: string): string {
  return `v${STORAGE_VERSION}:${PREFIX}:${rawKey}`;
}

export function purgeOldVersions(): void {
  if (typeof localStorage === "undefined") return;
  const current = `v${STORAGE_VERSION}:${PREFIX}:`;
  const pattern = /^v\d+:bucks:/;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && pattern.test(k) && !k.startsWith(current)) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  }
}
