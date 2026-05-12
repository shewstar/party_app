"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import BigButton from "@/components/BigButton";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase/browser";
import { clearUserId } from "@/lib/session";
import { useUser } from "@/lib/user-context";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, refresh } = useUser();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [firstDrink, setFirstDrink] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setWeight(user.weight_kg?.toString() ?? "");
    setFirstDrink(toLocalInput(user.first_drink_at));
  }, [user]);

  if (loading || !user) {
    return <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase()
      .from("users")
      .update({
        name: name.trim(),
        weight_kg: weight ? Number(weight) : null,
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

  async function leaveParty() {
    if (!confirm("Forget this device's identity? You'll be onboarded as a new user.")) return;
    clearUserId();
    router.replace("/onboarding");
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
            <BigButton variant="secondary" onClick={leaveParty}>
              Forget this device
            </BigButton>
          </div>
        </Card>
      </div>
    </main>
  );
}
