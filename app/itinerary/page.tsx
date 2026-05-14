"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import BigButton from "@/components/BigButton";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { useOnlineStatus } from "@/lib/offline-queue";
import { SkeletonCard } from "@/components/Skeleton";
import { useTableData } from "@/lib/realtime-provider";
import type { ItineraryEventRow, ItineraryReactionRow, UserRow } from "@/lib/supabase/types";

const REACTIONS = ["👍", "😂", "🍻", "🔥", "🎉", "💀"];

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday: "short" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ItineraryPage() {
  const { user, loading } = useUser();
  const { online, enqueue } = useOnlineStatus();
  const { data: events } = useTableData<ItineraryEventRow>("itinerary_events");
  const { data: users } = useTableData<UserRow>("users");
  const [reactions, setReactions] = useState<ItineraryReactionRow[]>([]);

  useEffect(() => {
    if (loading) return;
    const s = supabase();
    s.from("itinerary_reactions").select("*").then(({ data }) => {
      setReactions((data ?? []) as ItineraryReactionRow[]);
    });
  }, [loading]);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aStart = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bStart = b.start_time ? new Date(b.start_time).getTime() : 0;
      if (aStart !== bStart) return aStart - bStart;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [events]);

  useEffect(() => {
    if (loading) return;
  }, [loading]);

  const reactionMap: Record<string, Record<string, { count: number; hasMine: boolean }>> = {};
  for (const r of reactions) {
    if (!reactionMap[r.event_id]) reactionMap[r.event_id] = {};
    if (!reactionMap[r.event_id][r.reaction]) reactionMap[r.event_id][r.reaction] = { count: 0, hasMine: false };
    reactionMap[r.event_id][r.reaction].count++;
    if (r.user_id === user?.id) reactionMap[r.event_id][r.reaction].hasMine = true;
  }

  async function toggleReaction(eventId: string, emoji: string) {
    if (!user) return;
    const myCurrent = reactions.find(r => r.event_id === eventId && r.user_id === user.id);

    if (myCurrent?.reaction === emoji) {
      setReactions(prev => prev.filter(r => !(r.event_id === eventId && r.user_id === user.id)));
      await supabase().from("itinerary_reactions").delete().eq("event_id", eventId).eq("user_id", user.id);
    } else {
      const removed = reactions.filter(r => !(r.event_id === eventId && r.user_id === user.id));
      setReactions([...removed, { event_id: eventId, user_id: user.id, reaction: emoji, created_at: new Date().toISOString() }]);
      await supabase().from("itinerary_reactions").upsert(
        { event_id: eventId, user_id: user.id, reaction: emoji },
        { onConflict: "event_id,user_id" },
      );
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setDesc("");
    setLocation("");
    setStart("");
    setEnd("");
  }

  function startAdd() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(evt: ItineraryEventRow) {
    setEditingId(evt.id);
    setTitle(evt.title);
    setDesc(evt.description ?? "");
    setLocation(evt.location ?? "");
    setStart(evt.start_time ? toLocalInput(evt.start_time) : "");
    setEnd(evt.end_time ? toLocalInput(evt.end_time) : "");
    setShowForm(true);
  }

  async function saveEvent() {
    if (!user || !title.trim()) return;
    setSaving(true);
    const s = supabase();
    const payload = {
      title: title.trim(),
      description: desc.trim() || null,
      location: location.trim() || null,
      start_time: start ? new Date(start).toISOString() : null,
      end_time: end ? new Date(end).toISOString() : null,
    };

    if (editingId) {
      await s.from("itinerary_events").update(payload).eq("id", editingId);
    } else {
      const insertPayload = { ...payload, created_by: user.id };
      if (!online) {
        enqueue("itinerary_events", insertPayload);
      } else {
        await s.from("itinerary_events").insert(insertPayload);
      }
    }

    resetForm();
    setSaving(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await supabase().from("itinerary_events").delete().eq("id", id);
  }

  const isEditor = user?.is_itinerary_editor ?? false;

  if (loading || !user) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Itinerary" />
        <div className="px-5 py-4 flex flex-col gap-4">
          <SkeletonCard rows={2} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Itinerary" />
      <div className="px-5 py-4 flex flex-col gap-4">

        {isEditor && !showForm && (
          <BigButton onClick={startAdd}>➕ Add Event</BigButton>
        )}

        {showForm && (
          <Card>
            <form onSubmit={(e) => { e.preventDefault(); saveEvent(); }} className="flex flex-col gap-3">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What's happening?"
                className="border border-line rounded-card px-3 py-2 bg-surface text-lg font-semibold"
                maxLength={100}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Start</span>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    className="border border-line rounded-card px-3 py-2 bg-surface text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">End</span>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={e => setEnd(e.target.value)}
                    className="border border-line rounded-card px-3 py-2 bg-surface text-sm"
                  />
                </label>
              </div>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Location (optional)"
                className="border border-line rounded-card px-3 py-2 bg-surface text-sm"
                maxLength={200}
              />
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Details (optional)"
                className="border border-line rounded-card px-3 py-2 bg-surface text-sm resize-none"
                rows={2}
                maxLength={500}
              />
              <div className="flex gap-2">
                <BigButton type="submit" disabled={saving || !title.trim()}>
                  {saving ? "Saving…" : editingId ? "Update" : "Add"}
                </BigButton>
                <BigButton variant="secondary" onClick={resetForm}>
                  Cancel
                </BigButton>
              </div>
            </form>
          </Card>
        )}

        {events.length === 0 && !showForm && (
          <p className="text-sm text-muted text-center py-8">No events yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {sortedEvents.map(evt => {
            const evtReactions = reactionMap[evt.id] ?? {};
            const creator = users.find(u => u.id === evt.created_by);
            const isEditing = editingId === evt.id;

            return (
              <Card key={evt.id} className={isEditing ? "ring-2 ring-accent" : ""}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-snug">{evt.title}</h3>
                    {isEditor && !isEditing && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(evt)} className="text-xs text-muted underline">Edit</button>
                        <button onClick={() => deleteEvent(evt.id)} className="text-xs text-danger underline">Delete</button>
                      </div>
                    )}
                    {isEditing && (
                      <span className="text-xs text-accent font-medium">Editing…</span>
                    )}
                  </div>

                  {(evt.start_time || evt.end_time) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted">{formatDay(evt.start_time)}</span>
                      <span className="text-accent font-medium tabular-nums">{formatTime(evt.start_time)}</span>
                      {evt.end_time && (
                        <>
                          <span className="text-muted">–</span>
                          <span className="text-muted tabular-nums">{formatTime(evt.end_time)}</span>
                        </>
                      )}
                    </div>
                  )}

                  {evt.location && (
                    <div className="text-sm text-muted flex items-center gap-1">
                      <span>📍</span>
                      <span>{evt.location}</span>
                    </div>
                  )}

                  {evt.description && (
                    <p className="text-sm text-ink/80 leading-relaxed">{evt.description}</p>
                  )}

                  {creator && (
                    <div className="text-xs text-muted flex items-center gap-1.5">
                      <Avatar name={creator.name} url={creator.avatar_url} size={18} />
                      <span>{creator.name}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-1 pt-2 border-t border-line">
                    {REACTIONS.map(emoji => {
                      const info = evtReactions[emoji];
                      const count = info?.count ?? 0;
                      const hasMine = info?.hasMine ?? false;
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(evt.id, emoji)}
                          aria-label={`React with ${emoji}${count > 0 ? `, ${count} reaction${count === 1 ? "" : "s"}` : ""}`}
                          aria-pressed={hasMine}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                            hasMine
                              ? "bg-accent text-white border-accent"
                              : "bg-surface text-ink border-line hover:bg-surface2"
                          }`}
                        >
                          <span aria-hidden>{emoji}</span>
                          {count > 0 && <span className={`tabular-nums text-xs font-medium ${hasMine ? "text-white/90" : "text-muted"}`}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
