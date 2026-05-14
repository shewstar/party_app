"use client";

import { vkey } from "./storage";

const USER_ID_KEY = vkey("user_id");

function genUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback — sufficient for client-only IDs.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = genUUID();
    window.localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_ID_KEY);
}

export function setUserId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_ID_KEY, id);
}

