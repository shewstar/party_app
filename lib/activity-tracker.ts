"use client";

import { notifyActivity } from "./activity-bus";

let installed = false;

// Patches localStorage and window.fetch in place so every read/write under the
// app's "v\d+:bucks:" namespace and every Supabase REST/auth request fires an
// activity event. Idempotent and cheap; safe to call multiple times.
export function installActivityTracker(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const proto = Storage.prototype;
  const origGet = proto.getItem;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const isOurKey = (k: string) => /^v\d+:bucks:/.test(k);

  proto.getItem = function (k: string) {
    if (isOurKey(k)) notifyActivity("ls");
    return origGet.call(this, k);
  };
  proto.setItem = function (k: string, v: string) {
    if (isOurKey(k)) notifyActivity("ls");
    return origSet.call(this, k, v);
  };
  proto.removeItem = function (k: string) {
    if (isOurKey(k)) notifyActivity("ls");
    return origRemove.call(this, k);
  };

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) return;
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith(supaUrl) && (url.includes("/rest/") || url.includes("/auth/"))) {
      notifyActivity("db");
    }
    return origFetch(input, init);
  };
}
