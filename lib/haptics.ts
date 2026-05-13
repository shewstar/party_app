"use client";

import { useCallback } from "react";

function vibrate(pattern: VibratePattern) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // silently no-op on unsupported devices
  }
}

export function useHaptic() {
  const light = useCallback(() => vibrate(10), []);
  const medium = useCallback(() => vibrate([15, 50, 15]), []);
  const success = useCallback(() => vibrate([30, 60, 30, 60, 60]), []);
  const error = useCallback(() => vibrate([50, 80, 50]), []);

  return { light, medium, success, error };
}
