"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import BigButton from "@/components/BigButton";
import Chip from "@/components/Chip";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import type { UserRow } from "@/lib/supabase/types";

const WHEEL_COLORS = [
  "#0f6c73",
  "#b3261e",
  "#e6a700",
  "#5b8def",
  "#7c5cff",
  "#1f9d55",
  "#d96b27",
  "#c2185b",
];

const R = 180;
const SPIN_MS = 8000;
const FULL_SPINS = 10;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function arcPath(startDeg: number, endDeg: number, radius: number) {
  const start = polar(startDeg, radius);
  const end = polar(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

export default function SpinPage() {
  const { user, loading } = useUser();
  const [members, setMembers] = useState<UserRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<UserRow | null>(null);
  const initialisedRef = useRef(false);

  async function load() {
    const s = supabase();
    const { data } = await s
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    setMembers((data ?? []) as UserRow[]);
  }

  useEffect(() => {
    if (loading) return;
    load();
    const s = supabase();
    const ch = s
      .channel("spin-members")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [loading]);

  useEffect(() => {
    if (initialisedRef.current || members.length === 0) return;
    setPicked(new Set(members.map((m) => m.id)));
    initialisedRef.current = true;
  }, [members]);

  const pool = useMemo(
    () => members.filter((m) => picked.has(m.id)),
    [members, picked],
  );

  function togglePick(id: string) {
    if (spinning) return;
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setWinner(null);
  }

  function selectAll() {
    if (spinning) return;
    setPicked(new Set(members.map((m) => m.id)));
    setWinner(null);
  }

  function clearAll() {
    if (spinning) return;
    setPicked(new Set());
    setWinner(null);
  }

  function spin() {
    if (spinning || pool.length < 2) return;
    const winnerIdx = Math.floor(Math.random() * pool.length);
    const sliceDeg = 360 / pool.length;
    const targetOffset = (360 - (winnerIdx + 0.5) * sliceDeg) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = ((targetOffset - current) + 360) % 360;
    setWinner(null);
    setSpinning(true);
    setRotation(rotation + FULL_SPINS * 360 + delta);
    const winnerUser = pool[winnerIdx];
    setTimeout(async () => {
      setSpinning(false);
      setWinner(winnerUser);
      await supabase().from("spins").insert({
        spinner_id: user?.id ?? null,
        winner_id: winnerUser.id,
        pool: pool.map((p) => p.id),
      });
    }, SPIN_MS + 50);
  }

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  const n = pool.length;
  const labelFontSize = n > 10 ? 13 : n > 6 ? 16 : 19;

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Spin" />
      <div className="px-5 py-4 flex flex-col gap-5">
        <Card>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-medium">Who&apos;s in?</span>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-accent underline disabled:opacity-50"
                disabled={spinning}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted underline disabled:opacity-50"
                disabled={spinning}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <Chip
                key={m.id}
                active={picked.has(m.id)}
                onClick={() => togglePick(m.id)}
              >
                {m.name}
              </Chip>
            ))}
            {members.length === 0 && (
              <span className="text-sm text-muted">No party members yet.</span>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-center py-2">
          <div className="relative w-full max-w-[420px]">
            <svg
              viewBox="-200 -200 400 400"
              className="w-full h-auto overflow-visible"
            >
              <g
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? `transform ${SPIN_MS}ms cubic-bezier(0.18, 0.9, 0.25, 1)`
                    : "none",
                  transformOrigin: "0 0",
                }}
              >
                {n === 0 && (
                  <circle r={R} fill="#e5e7eb" stroke="#cbd5e1" strokeWidth={2} />
                )}
                {n === 1 && (
                  <>
                    <circle
                      r={R}
                      fill={WHEEL_COLORS[0]}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                    <text
                      x={0}
                      y={0}
                      fill="white"
                      fontSize={22}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {pool[0].name.slice(0, 12)}
                    </text>
                  </>
                )}
                {n >= 2 &&
                  pool.map((m, i) => {
                    const start = (i / n) * 360;
                    const end = ((i + 1) / n) * 360;
                    const mid = (start + end) / 2;
                    const labelPos = polar(mid, R * 0.62);
                    return (
                      <g key={m.id}>
                        <path
                          d={arcPath(start, end, R)}
                          fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill="white"
                          fontSize={labelFontSize}
                          fontWeight={600}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid} ${labelPos.x} ${labelPos.y})`}
                        >
                          {m.name.slice(0, 10)}
                        </text>
                      </g>
                    );
                  })}
              </g>
              <circle r={14} fill="#1f2937" stroke="#fff" strokeWidth={2} />
              <polygon
                points={`0,${-R - 18} -14,${-R + 8} 14,${-R + 8}`}
                fill="#1f2937"
                stroke="#fff"
                strokeWidth={2}
              />
            </svg>
          </div>
        </div>

        <BigButton
          onClick={spin}
          disabled={spinning || pool.length < 2}
        >
          {spinning ? "Spinning…" : pool.length < 2 ? "Pick at least 2" : "🎡 Spin"}
        </BigButton>

        {winner && !spinning && (
          <Card>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-xs uppercase tracking-wide text-muted">
                Winner
              </div>
              <Avatar name={winner.name} url={winner.avatar_url} size={72} />
              <div className="text-2xl font-bold">{winner.name}</div>
              <button
                type="button"
                onClick={spin}
                className="text-sm text-accent underline"
              >
                Spin again
              </button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
