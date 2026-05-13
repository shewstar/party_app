"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { partyDayKey } from "@/lib/recap";
import {
  applyDisposableFilter,
  pickFilterVariant,
  playShutterSound,
} from "@/lib/disposable-filter";

const DAILY_LIMIT = 3;

export default function CameraPage() {
  const { user, loading } = useUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [usedToday, setUsedToday] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const todayKey = partyDayKey(Date.now());
  const remaining = usedToday === null ? null : Math.max(0, DAILY_LIMIT - usedToday);
  const outOfFilm = usedToday !== null && usedToday >= DAILY_LIMIT;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPermissionAsked(true);
    stopStream();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const insecure =
        typeof window !== "undefined" &&
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      setError(
        insecure
          ? `Camera needs HTTPS. Open this page over https:// (or via localhost). You're on ${window.location.protocol}//${window.location.host}.`
          : "Camera API isn't available in this browser.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      setError(msg);
    }
  }, [facing, stopStream]);

  useEffect(() => {
    startCamera();
    return stopStream;
  }, [startCamera, stopStream]);

  useEffect(() => {
    if (!user) return;
    const s = supabase();
    let cancelled = false;

    async function loadCount() {
      if (!user) return;
      const { count } = await s
        .from("camera_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("party_day", todayKey);
      if (!cancelled) setUsedToday(count ?? 0);
    }
    loadCount();

    const ch = s
      .channel(`camera-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "camera_photos", filter: `user_id=eq.${user.id}` },
        () => loadCount(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      s.removeChannel(ch);
    };
  }, [user, todayKey]);

  async function shoot() {
    if (!user || !videoRef.current || capturing || outOfFilm) return;
    const video = videoRef.current;
    if (!video.videoWidth) return;

    setCapturing(true);
    setFlashing(true);
    playShutterSound();
    setTimeout(() => setFlashing(false), 120);

    try {
      const variant = pickFilterVariant();
      const blob = await applyDisposableFilter(video, variant);
      const id = crypto.randomUUID();
      const path = `${todayKey}/${user.id}/${id}.jpg`;
      const s = supabase();
      const { error: upErr } = await s.storage
        .from("camera-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { data } = s.storage.from("camera-photos").getPublicUrl(path);
      const { error: insErr } = await s.from("camera_photos").insert({
        id,
        user_id: user.id,
        storage_path: path,
        photo_url: data.publicUrl,
        party_day: todayKey,
        filter_variant: variant,
      });
      if (insErr) throw insErr;
      setUsedToday((n) => (n === null ? 1 : n + 1));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Capture failed";
      setError(msg);
    } finally {
      setCapturing(false);
    }
  }

  function flipCamera() {
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  }

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  return (
    <main className="flex-1 flex flex-col bg-black text-white">
      <TopBar title="Camera" />

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {!error && (
          <div className="absolute top-3 right-3 z-10">
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums shadow-card ${
                outOfFilm ? "bg-danger text-white" : "bg-black/65 text-white"
              }`}
            >
              {remaining === null ? "…" : `${remaining} shot${remaining === 1 ? "" : "s"} left`}
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/85">
            <p className="text-sm text-white/90">{error}</p>
            <button
              onClick={startCamera}
              className="rounded-full bg-white text-ink px-5 py-2 font-semibold"
            >
              {permissionAsked ? "Retry camera" : "Allow camera"}
            </button>
          </div>
        )}

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-100 ${
            flashing ? "opacity-90" : "opacity-0"
          }`}
        />

        {outOfFilm && (
          <div className="absolute inset-x-0 bottom-32 flex justify-center pointer-events-none">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm">
              🎞 No film left. Develops at 5am.
            </span>
          </div>
        )}
      </div>

      <div className="relative bg-black px-6 py-6 flex items-center justify-between">
        <button
          onClick={flipCamera}
          className="w-12 h-12 rounded-full bg-white/15 text-white text-xl flex items-center justify-center"
          aria-label="Flip camera"
        >
          🔄
        </button>

        <button
          onClick={shoot}
          disabled={capturing || outOfFilm || !!error}
          aria-label="Take photo"
          className="w-20 h-20 rounded-full bg-white border-4 border-white/40 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
        />

        <Link
          href="/camera/gallery"
          className="w-12 h-12 rounded-full bg-white/15 text-white text-xl flex items-center justify-center"
          aria-label="Gallery"
        >
          🎞
        </Link>
      </div>

      <p className="bg-black text-center text-xs text-white/60 px-4 pb-4">
        No previews. No retakes. Photos develop at 5am.
      </p>
    </main>
  );
}
