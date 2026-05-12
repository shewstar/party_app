import type { DrinkRow, UserRow } from "./supabase/types";
import { gramsAlcohol } from "./drinks";

// Bucks party — assume all attendees are male.
const R = 0.68;
const BETA_PER_HOUR = 0.015;

export type BacResult =
  | { status: "ok"; value: number }
  | { status: "missing_profile" };

export function estimateBAC(user: UserRow, drinks: DrinkRow[]): BacResult {
  if (!user.weight_kg) return { status: "missing_profile" };
  if (drinks.length === 0) return { status: "ok", value: 0 };

  const sessionStartMs = user.first_drink_at
    ? new Date(user.first_drink_at).getTime()
    : Math.min(...drinks.map((d) => new Date(d.logged_at).getTime()));

  const sessionDrinks = drinks.filter(
    (d) => new Date(d.logged_at).getTime() >= sessionStartMs,
  );
  if (sessionDrinks.length === 0) return { status: "ok", value: 0 };

  const totalGrams = sessionDrinks.reduce(
    (sum, d) => sum + gramsAlcohol(d.volume_ml, d.abv),
    0,
  );
  const rawBac = (totalGrams / (user.weight_kg * 1000 * R)) * 100;

  const hoursElapsed = Math.max(0, (Date.now() - sessionStartMs) / 3_600_000);

  const value = Math.max(0, rawBac - BETA_PER_HOUR * hoursElapsed);
  return { status: "ok", value };
}

export function formatBAC(result: BacResult): string {
  if (result.status === "missing_profile") return "—";
  return result.value.toFixed(3);
}
