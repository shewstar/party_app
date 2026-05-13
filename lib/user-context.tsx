"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "./supabase/browser";
import type { UserRow } from "./supabase/types";
import { getOrCreateUserId, getUserId } from "./session";
import { partyDayKey } from "./recap";

const APP_OPEN_THROTTLE_MS = 5 * 60 * 1000;
const APP_OPEN_KEY_PREFIX = "lastAppOpen";

async function logAppOpen(userId: string) {
  try {
    const key = `${APP_OPEN_KEY_PREFIX}:${userId}`;
    const last = Number(localStorage.getItem(key) ?? 0);
    const now = Date.now();
    if (last && now - last < APP_OPEN_THROTTLE_MS) return;
    localStorage.setItem(key, String(now));
    await supabase()
      .from("app_opens")
      .insert({ user_id: userId, party_day: partyDayKey(now) });
  } catch {
    // ignore — logging failures shouldn't break the app
  }
}

type Ctx = {
  userId: string | null;
  user: UserRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<Ctx>({
  userId: null,
  user: null,
  loading: true,
  refresh: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser(id: string) {
    const { data, error } = await supabase().from("users").select("*").eq("id", id).maybeSingle();
    if (error) return null;
    if (data) setUser(data);
    return data;
  }

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    loadUser(id).finally(() => setLoading(false));
    logAppOpen(id);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase()
      .channel(`user:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
        (payload) => setUser(payload.new as UserRow),
      )
      .subscribe();
    return () => {
      supabase().removeChannel(ch);
    };
  }, [userId]);

  const value = useMemo<Ctx>(
    () => ({
      userId,
      user,
      loading,
      refresh: async () => {
        const id = getUserId();
        if (id !== userId) setUserId(id);
        if (!id) {
          setUser(null);
          return;
        }
        await loadUser(id);
      },
    }),
    [userId, user, loading],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

export function ensureUserId(): string {
  return getOrCreateUserId();
}
