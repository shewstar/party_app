"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/user-context";
import {
  dismissPrompt,
  enablePush,
  getPermissionState,
  isDismissed,
  isIosSafari,
  isStandalone,
  pushSupported,
  registerServiceWorker,
} from "@/lib/push/client";

type Mode = "hidden" | "enable" | "ios-install";

export default function PushPermissionBanner() {
  const { userId, user, loading } = useUser();
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (loading || !user || !userId) {
      setMode("hidden");
      return;
    }
    if (isDismissed()) {
      setMode("hidden");
      return;
    }
    if (!pushSupported()) {
      if (isIosSafari() && !isStandalone()) {
        setMode("ios-install");
      } else {
        setMode("hidden");
      }
      return;
    }
    const perm = getPermissionState();
    if (perm === "default") {
      setMode("enable");
    } else if (perm === "unsupported" && isIosSafari() && !isStandalone()) {
      setMode("ios-install");
    } else {
      setMode("hidden");
    }
  }, [loading, user, userId]);

  if (mode === "hidden") return null;

  async function onEnable() {
    if (!userId) return;
    setBusy(true);
    const ok = await enablePush(userId);
    setBusy(false);
    if (ok) setMode("hidden");
  }

  function onDismiss() {
    dismissPrompt();
    setMode("hidden");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto bg-surface border border-line rounded-card shadow-card p-4 flex flex-col gap-3">
        {mode === "enable" ? (
          <>
            <div>
              <p className="font-semibold">Get pinged when stuff happens</p>
              <p className="text-sm text-muted">
                New votes, voted-in proposals, itinerary updates, and buck alerts.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onEnable}
                disabled={busy}
                className="flex-1 bg-accent text-white rounded-card py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Enabling…" : "Enable notifications"}
              </button>
              <button
                onClick={onDismiss}
                className="px-3 text-sm text-muted"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-semibold">Turn on notifications</p>
              <p className="text-sm text-muted">
                On iPhone, tap the Share icon → <strong>Add to Home Screen</strong>, then open the
                app from your home screen to enable push.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onDismiss}
                className="flex-1 bg-surface2 border border-line rounded-card py-2 text-sm font-semibold"
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
