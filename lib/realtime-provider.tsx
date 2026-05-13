"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "./supabase/browser";
import { useBattery } from "./battery";

type TableName =
  | "users"
  | "drink_entries"
  | "vote_items"
  | "vote_responses"
  | "games"
  | "game_players"
  | "game_scores"
  | "spins"
  | "camera_photos"
  | "itinerary_events"
  | "itinerary_reactions"
  | "app_opens"
  | "v_drinks_leaderboard"
  | "v_vote_tally"
  | "v_game_totals";

const VIEW_DEPENDENCIES: Record<string, TableName[]> = {
  v_drinks_leaderboard: ["drink_entries", "users"],
  v_vote_tally: ["vote_items", "vote_responses"],
  v_game_totals: ["game_scores", "game_players", "users"],
};

const ALL_TABLES: TableName[] = [
  "users",
  "drink_entries",
  "vote_items",
  "vote_responses",
  "games",
  "game_players",
  "game_scores",
  "spins",
  "camera_photos",
  "itinerary_events",
  "itinerary_reactions",
  "app_opens",
  "v_drinks_leaderboard",
  "v_vote_tally",
  "v_game_totals",
];

type Cache = Map<TableName, unknown[]>;

type Listener = () => void;

type RealtimeCtx = {
  getTable: <T>(table: TableName) => T[];
  ready: boolean;
  refreshTable: (table: TableName) => Promise<void>;
  subscribe: (table: TableName, listener: Listener) => () => void;
};

const Ctx = createContext<RealtimeCtx>({
  getTable: () => [],
  ready: false,
  refreshTable: async () => {},
  subscribe: () => () => {},
});

async function fetchTable(table: TableName) {
  const s = supabase();
  const { data, error } = await s.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as unknown[];
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Cache>(new Map());
  const listenersRef = useRef<Map<TableName, Set<Listener>>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof supabase>["channel"]> | null>(null);
  const [ready, setReady] = useState(false);
  const { throttleMs } = useBattery();
  const pendingRef = useRef<Set<TableName>>(new Set());
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch of all tables
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled(
          ALL_TABLES.map((t) => fetchTable(t)),
        );
        const cache = new Map<TableName, unknown[]>();
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            cache.set(ALL_TABLES[i], r.value);
          } else {
            cache.set(ALL_TABLES[i], []);
          }
        });
        if (!cancelled) {
          cacheRef.current = cache;
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Single Supabase realtime channel
  useEffect(() => {
    if (!ready) return;
    const s = supabase();
    const rawTables = ALL_TABLES.filter((t) => !t.startsWith("v_"));
    let ch = s.channel("party-realtime");
    for (const t of rawTables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        () => {
          if (throttleMs > 0) {
            pendingRef.current.add(t);
            // Also mark dependent views
            for (const [view, deps] of Object.entries(VIEW_DEPENDENCIES)) {
              if (deps.includes(t)) pendingRef.current.add(view as TableName);
            }
            if (!throttleTimerRef.current) {
              throttleTimerRef.current = setTimeout(() => {
                const pending = [...pendingRef.current];
                pendingRef.current.clear();
                throttleTimerRef.current = null;
                for (const table of pending) {
                  refetchTable(table);
                }
              }, throttleMs);
            }
            return;
          }
          refetchTable(t);
          // Also refresh dependent views
          for (const [view, deps] of Object.entries(VIEW_DEPENDENCIES)) {
            if (deps.includes(t)) refetchTable(view as TableName);
          }
        },
      );
    }
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      s.removeChannel(ch);
    };
  }, [ready, throttleMs]);

  async function refetchTable(table: TableName) {
    try {
      const data = await fetchTable(table);
      cacheRef.current.set(table, data);
      // Notify only subscribers of this table — context value stays stable so
      // unrelated consumers don't re-render on every realtime event.
      listenersRef.current.get(table)?.forEach((fn) => fn());
    } catch {
      // network error — keep stale cache
    }
  }

  const refreshTable = useCallback(async (table: TableName) => {
    await refetchTable(table);
  }, []);

  const getTable = useCallback(
    <T,>(table: TableName): T[] => {
      return (cacheRef.current.get(table) ?? []) as T[];
    },
    [],
  );

  const subscribe = useCallback(
    (table: TableName, listener: Listener): (() => void) => {
      const map = listenersRef.current;
      if (!map.has(table)) map.set(table, new Set());
      map.get(table)!.add(listener);
      return () => {
        map.get(table)?.delete(listener);
      };
    },
    [],
  );

  const value = useMemo<RealtimeCtx>(
    () => ({ getTable, ready, refreshTable, subscribe }),
    [getTable, ready, refreshTable, subscribe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTableData<T>(table: TableName): { data: T[]; loading: boolean } {
  const ctx = useContext(Ctx);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!ctx.ready) return;
    return ctx.subscribe(table, () => forceRender((n) => n + 1));
  }, [ctx, table]);

  return {
    data: ctx.getTable<T>(table),
    loading: !ctx.ready,
  };
}

export function useRealtimeReady() {
  return useContext(Ctx).ready;
}

export function useRefreshTable() {
  return useContext(Ctx).refreshTable;
}
