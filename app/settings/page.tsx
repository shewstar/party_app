"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import BigButton from "@/components/BigButton";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import { useTableData } from "@/lib/realtime-provider";
import type { AppSettingsRow, UserRow } from "@/lib/supabase/types";

const HIDDEN_TAPS = 5;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsPage() {
  const { user, loading, refresh } = useUser();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [firstDrink, setFirstDrink] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hidden itinerary editor toggle
  const [hiddenTap, setHiddenTap] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [togglingEditor, setTogglingEditor] = useState(false);

  // Crew
  const [crew, setCrew] = useState<UserRow[]>([]);

  // Party-wide roster lock — when on, new users can't be created via
  // /api/onboarding. Permissive RLS, so anyone with admin UI can toggle it.
  const { data: settingsData } = useTableData<AppSettingsRow>("app_settings");
  const rosterLocked = settingsData[0]?.roster_locked ?? false;
  const [togglingRoster, setTogglingRoster] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setWeight(user.weight_kg?.toString() ?? "");
    setFirstDrink(toLocalInput(user.first_drink_at));
  }, [user]);

  useEffect(() => {
    if (showEditor) loadCrew();
  }, [showEditor]);

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    let weight_kg: number | null = null;
    if (weight) {
      const w = Number(weight);
      if (isNaN(w) || w < 20 || w > 300) {
        setMsg("Weight must be between 20 and 300 kg.");
        return;
      }
      weight_kg = w;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await supabase()
      .from("users")
      .update({
        name: name.trim(),
        weight_kg,
        first_drink_at: firstDrink ? new Date(firstDrink).toISOString() : null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Saved.");
    await refresh();
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    setMsg(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}.${ext}`;
    const s = supabase();
    const { error: upErr } = await s.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "60",
    });
    if (upErr) {
      setMsg(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = s.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: updErr } = await s.from("users").update({ avatar_url: url }).eq("id", user.id);
    setUploading(false);
    if (updErr) {
      setMsg(updErr.message);
      return;
    }
    setMsg("Avatar updated.");
    await refresh();
  }

  async function clearDrinks() {
    if (!user) return;
    if (!confirm("Clear all your drink history? This can't be undone.")) return;
    const { error } = await supabase().from("drink_entries").delete().eq("user_id", user.id);
    if (error) setMsg(error.message);
    else setMsg("Drink history cleared.");
  }

  async function loadCrew() {
    const { data } = await supabase().from("users").select("*").order("name");
    setCrew((data ?? []) as UserRow[]);
  }

  async function makeBuck(targetId: string) {
    if (!user) return;
    setMsg(null);
    const s = supabase();
    await s.from("users").update({ is_buck: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await s.from("users").update({ is_buck: true }).eq("id", targetId);
    if (error) { setMsg(error.message); return; }
    await loadCrew();
    if (targetId === user.id) await refresh();
  }

  async function toggleRoster() {
    setTogglingRoster(true);
    setMsg(null);
    const next = !rosterLocked;
    const { error } = await supabase()
      .from("app_settings")
      .update({ roster_locked: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setTogglingRoster(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(next ? "Roster locked — no new bucks." : "Roster unlocked.");
  }

  async function toggleEditor() {
    if (!user) return;
    setTogglingEditor(true);
    const next = !user.is_itinerary_editor;
    const { error } = await supabase()
      .from("users")
      .update({ is_itinerary_editor: next })
      .eq("id", user.id);
    setTogglingEditor(false);
    if (error) { setMsg(error.message); return; }
    setMsg(next ? "You are now an itinerary editor." : "Itinerary editor disabled.");
    await refresh();
  }

  function handleHiddenTap() {
    const next = hiddenTap + 1;
    setHiddenTap(next);
    if (next >= HIDDEN_TAPS) {
      setShowEditor(true);
      setHiddenTap(0);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title="Settings" />
      <div className="px-5 py-4 flex flex-col gap-5">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} url={user.avatar_url} size={64} />
            <label className="text-sm text-accent underline cursor-pointer">
              {uploading ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
            </label>
          </div>
        </Card>

        <Card>
          <form onSubmit={save} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-line rounded-card px-3 py-2 bg-surface"
                maxLength={40}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Weight (kg)</span>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                type="number"
                inputMode="decimal"
                min={20}
                max={300}
                step="any"
                className="border border-line rounded-card px-3 py-2 bg-surface"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">First drink time</span>
              <input
                type="datetime-local"
                value={firstDrink}
                onChange={(e) => setFirstDrink(e.target.value)}
                className="border border-line rounded-card px-3 py-2 bg-surface"
              />
              <span className="text-xs text-muted">
                Used to model alcohol elimination over time.
              </span>
            </label>
            <BigButton type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </BigButton>
            {msg && <p className="text-sm text-muted text-center">{msg}</p>}
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">Danger zone</h2>
          <div className="flex flex-col gap-3">
            <BigButton variant="danger" onClick={clearDrinks}>
              Clear my drink history
            </BigButton>
          </div>
        </Card>

        <div className="flex justify-center">
          <button
            onClick={handleHiddenTap}
            className={`text-xs transition ${
              showEditor ? "text-muted/40" : "text-muted/10 hover:text-muted/30"
            }`}
          >
            {showEditor ? "🛠️" : "·"}
          </button>
        </div>

        {showEditor && (
          <>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Itinerary Editor</div>
                  <div className="text-xs text-muted">Add & edit events on the itinerary</div>
                </div>
                <button
                  onClick={toggleEditor}
                  disabled={togglingEditor}
                  className={`relative w-11 h-6 rounded-full transition ${
                    user.is_itinerary_editor ? "bg-accent" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                      user.is_itinerary_editor ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Lock the roster</div>
                  <div className="text-xs text-muted">
                    {rosterLocked
                      ? "No new bucks can join from this point."
                      : "Anyone past the gate can still onboard."}
                  </div>
                </div>
                <button
                  onClick={toggleRoster}
                  disabled={togglingRoster}
                  aria-label={rosterLocked ? "Unlock roster" : "Lock roster"}
                  className={`relative w-11 h-6 rounded-full transition ${
                    rosterLocked ? "bg-danger" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                      rosterLocked ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </Card>

            <Card>
              <h2 className="font-semibold mb-3">Crew</h2>
              {crew.length === 0 && (
                <p className="text-sm text-muted">No one else here yet.</p>
              )}
              <ul className="flex flex-col gap-2">
                {crew.map(member => (
                  <li key={member.id} className="flex items-center gap-3">
                    <Avatar name={member.name} url={member.avatar_url} size={36} isBuck={member.is_buck} />
                    <span className="flex-1 font-medium text-sm truncate">{member.name}</span>
                    {member.is_buck ? (
                      <span className="text-sm shrink-0">👑 Buck</span>
                    ) : (
                      <button
                        onClick={() => makeBuck(member.id)}
                        className="text-xs text-accent underline shrink-0"
                      >
                        Make Buck
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
