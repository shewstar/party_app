import type { DrinkCategory, DrinkRow } from "./supabase/types";

export type Preset = {
  id: string;
  label: string;
  volume_ml: number;
  abv: number;
};

export const PRESETS: Record<DrinkCategory, Preset[]> = {
  beer: [
    { id: "schooner", label: "Schooner — 425ml @ 4.8%", volume_ml: 425, abv: 0.048 },
    { id: "pint", label: "Pint — 568ml @ 5%", volume_ml: 568, abv: 0.05 },
    { id: "stubby", label: "Stubby — 375ml @ 4.8%", volume_ml: 375, abv: 0.048 },
    { id: "light", label: "Light — 375ml @ 3.5%", volume_ml: 375, abv: 0.035 },
    { id: "craft", label: "Craft — 330ml @ 6%", volume_ml: 330, abv: 0.06 },
  ],
  wine: [
    { id: "small_glass", label: "Small glass — 150ml @ 12%", volume_ml: 150, abv: 0.12 },
    { id: "large_glass", label: "Large glass — 250ml @ 13%", volume_ml: 250, abv: 0.13 },
    { id: "fortified", label: "Fortified — 60ml @ 18%", volume_ml: 60, abv: 0.18 },
    { id: "sparkling", label: "Sparkling — 150ml @ 11.5%", volume_ml: 150, abv: 0.115 },
  ],
  spirits: [
    { id: "shot", label: "Shot — 30ml @ 40%", volume_ml: 30, abv: 0.4 },
    { id: "double", label: "Double — 60ml @ 40%", volume_ml: 60, abv: 0.4 },
    { id: "mixed", label: "Mixed drink — 45ml @ 40%", volume_ml: 45, abv: 0.4 },
    { id: "cocktail", label: "Cocktail — 60ml @ 30%", volume_ml: 60, abv: 0.3 },
  ],
};

// One Australian standard drink = 10g of ethanol. Ethanol density ≈ 0.789 g/mL.
const ETHANOL_G_PER_ML = 0.789;
const STANDARD_DRINK_G = 10;

export function gramsAlcohol(volume_ml: number, abv: number): number {
  return volume_ml * abv * ETHANOL_G_PER_ML;
}

export function standardDrinks(volume_ml: number, abv: number): number {
  return gramsAlcohol(volume_ml, abv) / STANDARD_DRINK_G;
}

export function categoryEmoji(c: DrinkCategory): string {
  return c === "beer" ? "🍺" : c === "wine" ? "🍷" : "🥃";
}

export function savedPresetsFromEntries(
  rows: Pick<DrinkRow, "id" | "category" | "label" | "volume_ml" | "abv">[],
  category: DrinkCategory,
): Preset[] {
  const seen = new Set<string>();
  const out: Preset[] = [];
  for (const r of rows) {
    if (r.category !== category) continue;
    const key = `${r.volume_ml}|${r.abv}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `saved:${r.id}`,
      label: r.label ?? `${r.volume_ml}ml @ ${(r.abv * 100).toFixed(1)}%`,
      volume_ml: r.volume_ml,
      abv: r.abv,
    });
  }
  return out;
}
