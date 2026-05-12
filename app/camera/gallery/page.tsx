"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { formatPartyDay, partyDayKey } from "@/lib/recap";
import type { CameraPhotoRow, UserRow } from "@/lib/supabase/types";

type PhotoWithPhotographer = CameraPhotoRow & {
  photographer: Pick<UserRow, "id" | "name" | "avatar_url"> | null;
};

export default function GalleryPage() {
  const [photos, setPhotos] = useState<PhotoWithPhotographer[]>([]);
  const [loading, setLoading] = useState(true);
  const todayKey = partyDayKey(Date.now());

  useEffect(() => {
    const s = supabase();
    let cancelled = false;

    async function load() {
      const [{ data: rows }, { data: users }] = await Promise.all([
        s
          .from("camera_photos")
          .select("*")
          .lt("party_day", todayKey)
          .order("taken_at", { ascending: false }),
        s.from("users").select("id, name, avatar_url"),
      ]);
      if (cancelled) return;
      const userMap = new Map<string, Pick<UserRow, "id" | "name" | "avatar_url">>(
        ((users ?? []) as Pick<UserRow, "id" | "name" | "avatar_url">[]).map((u) => [u.id, u]),
      );
      const combined: PhotoWithPhotographer[] = ((rows ?? []) as CameraPhotoRow[]).map((p) => ({
        ...p,
        photographer: userMap.get(p.user_id) ?? null,
      }));
      setPhotos(combined);
      setLoading(false);
    }
    load();

    const ch = s
      .channel("gallery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "camera_photos" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      s.removeChannel(ch);
    };
  }, [todayKey]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, PhotoWithPhotographer[]>();
    for (const p of photos) {
      const list = byDay.get(p.party_day) ?? [];
      list.push(p);
      byDay.set(p.party_day, list);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Developed rolls" />
      <div className="px-5 py-4 flex flex-col gap-5">
        <Link
          href="/camera"
          className="text-sm text-accent underline self-start"
        >
          ← Back to camera
        </Link>

        {loading && <p className="text-center text-muted text-sm">Loading…</p>}

        {!loading && grouped.length === 0 && (
          <Card>
            <p className="text-sm text-muted text-center py-6">
              🎞 No rolls developed yet. Photos appear here after 5am.
            </p>
          </Card>
        )}

        {grouped.map(([day, dayPhotos]) => (
          <section key={day} className="flex flex-col gap-3">
            <h2 className="font-semibold text-lg">{formatPartyDay(day, todayKey)}</h2>
            <div className="grid grid-cols-2 gap-3">
              {dayPhotos.map((p) => (
                <div
                  key={p.id}
                  className="relative rounded-card overflow-hidden border border-line bg-surface shadow-card"
                >
                  <img
                    src={p.photo_url}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-square object-cover"
                  />
                  {p.photographer && (
                    <div className="absolute bottom-1 left-1 right-1 flex items-center gap-2 bg-black/55 text-white rounded-full px-2 py-1">
                      <Avatar
                        name={p.photographer.name}
                        url={p.photographer.avatar_url}
                        size={20}
                      />
                      <span className="text-xs truncate">{p.photographer.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
