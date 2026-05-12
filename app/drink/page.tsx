"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Chip from "@/components/Chip";
import BigButton from "@/components/BigButton";
import {
  PRESETS,
  standardDrinks,
  categoryEmoji,
  savedPresetsFromEntries,
  type Preset,
} from "@/lib/drinks";
import { estimateBAC } from "@/lib/bac";
import { supabase } from "@/lib/supabase/browser";
import { useUser } from "@/lib/user-context";
import type { DrinkCategory, DrinkRow } from "@/lib/supabase/types";

export default function AddDrinkPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [category, setCategory] = useState<DrinkCategory | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customVol, setCustomVol] = useState("");
  const [customAbv, setCustomAbv] = useState("");
  const [saveForNext, setSaveForNext] = useState(false);
  const [savedPresets, setSavedPresets] = useState<Preset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (presetId !== "custom") setSaveForNext(false);
  }, [presetId]);

  useEffect(() => {
    if (!user || !category) {
      setSavedPresets([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase()
        .from("drink_entries")
        .select("id, category, label, volume_ml, abv")
        .eq("user_id", user.id)
        .eq("is_saved_preset", true);
      if (cancelled) return;
      setSavedPresets(savedPresetsFromEntries(data ?? [], category));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, category]);

  if (loading || !user) {
    return (
      <main className="flex-1 px-5 py-8 text-center text-muted">Loading…</main>
    );
  }

  async function submit() {
    if (!user || !category) return;
    let volume_ml: number;
    let abv: number;
    let label: string | null = null;
    const isCustom = presetId === "custom";
    if (isCustom) {
      volume_ml = Number(customVol);
      const abvPct = Number(customAbv);
      abv = abvPct / 100;
      label = `Custom — ${volume_ml}ml @ ${customAbv}%`;
      if (
        isNaN(volume_ml) ||
        isNaN(abvPct) ||
        volume_ml <= 0 ||
        volume_ml > 2000 ||
        abvPct < 0.1 ||
        abvPct > 95
      )
        return;
    } else {
      const preset = presetId?.startsWith("saved:")
        ? savedPresets.find((p) => p.id === presetId)
        : PRESETS[category].find((p) => p.id === presetId);
      if (!preset) return;
      volume_ml = preset.volume_ml;
      abv = preset.abv;
      label = preset.label;
    }
    setSubmitting(true);
    const sd = standardDrinks(volume_ml, abv);
    const s = supabase();

    let startNewSession = !user.first_drink_at;
    if (!startNewSession) {
      const { data: existing } = await s
        .from("drink_entries")
        .select("*")
        .eq("user_id", user.id);
      const bac = estimateBAC(user, (existing ?? []) as DrinkRow[]);
      if (bac.status === "ok" && bac.value === 0) startNewSession = true;
    }

    const nowIso = new Date().toISOString();
    const { error: err } = await s.from("drink_entries").insert({
      user_id: user.id,
      category,
      label,
      volume_ml,
      abv,
      standard_drinks: sd,
      ...(isCustom && saveForNext ? { is_saved_preset: true } : {}),
      ...(startNewSession ? { logged_at: nowIso } : {}),
    });
    if (startNewSession) {
      await s
        .from("users")
        .update({ first_drink_at: nowIso })
        .eq("id", user.id);
    }
    setSubmitting(false);
    if (err) {
      alert(err.message);
      return;
    }
    router.push("/");
  }

  if (!category) {
    return (
      <main className="flex-1 flex flex-col">
        <TopBar title="Add a drink" />
        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-muted">What are you drinking?</p>
          {(["beer", "wine", "spirits"] as DrinkCategory[]).map((c) => (
            <BigButton key={c} onClick={() => setCategory(c)} variant="secondary">
              <span className="text-3xl mr-2" aria-hidden>
                {categoryEmoji(c)}
              </span>
              <span className="capitalize text-xl">{c}</span>
            </BigButton>
          ))}
        </div>
      </main>
    );
  }

  const presets = PRESETS[category];
  const canSubmit =
    presetId &&
    (presetId !== "custom" ||
      (Number(customVol) > 0 &&
        Number(customVol) <= 2000 &&
        Number(customAbv) >= 0.1 &&
        Number(customAbv) <= 95));

  return (
    <main className="flex-1 flex flex-col">
      <TopBar title={`Add ${category}`} />
      <div className="px-5 py-4 flex flex-col gap-5">
        <Card>
          <div className="text-sm text-muted mb-2">Pick a size</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p.id} active={presetId === p.id} onClick={() => setPresetId(p.id)}>
                {p.label}
              </Chip>
            ))}
            {savedPresets.map((p) => (
              <Chip key={p.id} active={presetId === p.id} onClick={() => setPresetId(p.id)}>
                {p.label}
              </Chip>
            ))}
            <Chip active={presetId === "custom"} onClick={() => setPresetId("custom")}>
              Custom…
            </Chip>
          </div>
          {presetId === "custom" && (
            <>
              <div className="flex gap-3 mt-4">
                <label className="flex-1 flex flex-col gap-1">
                  <span className="text-xs text-muted">Volume (ml)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                  min={1}
                  max={2000}
                  step="any"
                    value={customVol}
                    onChange={(e) => setCustomVol(e.target.value)}
                    className="border border-line rounded-card px-3 py-2 bg-surface"
                  />
                </label>
                <label className="flex-1 flex flex-col gap-1">
                  <span className="text-xs text-muted">ABV (%)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                  min={0.1}
                  max={95}
                  step="any"
                    value={customAbv}
                    onChange={(e) => setCustomAbv(e.target.value)}
                    className="border border-line rounded-card px-3 py-2 bg-surface"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={saveForNext}
                  onChange={(e) => setSaveForNext(e.target.checked)}
                />
                <span>Save for next time</span>
              </label>
            </>
          )}
        </Card>

        <BigButton onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? "Logging…" : "Log it"}
        </BigButton>
        <button
          className="text-sm text-muted underline self-center"
          onClick={() => {
            setCategory(null);
            setPresetId(null);
          }}
        >
          ← Change category
        </button>
      </div>
    </main>
  );
}
