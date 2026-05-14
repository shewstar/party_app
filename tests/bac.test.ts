import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { estimateBAC, peakBAC, formatBAC } from "@/lib/bac";
import type { DrinkRow, UserRow } from "@/lib/supabase/types";

function user(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "u1",
    name: "Tester",
    weight_kg: 80,
    sex: "male",
    first_drink_at: null,
    avatar_url: null,
    is_itinerary_editor: false,
    is_buck: false,
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
}

function drink(
  loggedAtMs: number,
  volume_ml: number,
  abv: number,
  overrides: Partial<DrinkRow> = {},
): DrinkRow {
  return {
    id: `d-${loggedAtMs}-${Math.random()}`,
    user_id: "u1",
    category: "beer",
    label: null,
    volume_ml,
    abv,
    standard_drinks: (volume_ml * abv * 0.789) / 10,
    logged_at: new Date(loggedAtMs).toISOString(),
    is_saved_preset: false,
    ...overrides,
  };
}

const NOW = new Date("2026-05-14T22:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("estimateBAC", () => {
  it("returns missing_profile when weight is unknown", () => {
    const r = estimateBAC(user({ weight_kg: null }), [drink(NOW, 568, 0.05)]);
    expect(r.status).toBe("missing_profile");
  });

  it("returns zero when there are no drinks", () => {
    const r = estimateBAC(user(), []);
    expect(r).toEqual({ status: "ok", value: 0 });
  });

  it("computes Widmark roughly correctly for a single pint at t=0", () => {
    // 568ml @ 5% ABV → ~22.4g ethanol. 80kg male: raw = (22.4 / (80000 * 0.68)) * 100 ≈ 0.0412
    const r = estimateBAC(user(), [drink(NOW, 568, 0.05)]);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.value).toBeCloseTo(0.0412, 3);
  });

  it("decays linearly at 0.015 per hour", () => {
    const drinks = [drink(NOW - 2 * 3_600_000, 568, 0.05)];
    const u = user({ first_drink_at: new Date(NOW - 2 * 3_600_000).toISOString() });
    const r = estimateBAC(u, drinks);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    // ~0.0412 raw - 2 * 0.015 = ~0.0112
    expect(r.value).toBeCloseTo(0.0112, 3);
  });

  it("clamps to zero when elimination exceeds raw BAC", () => {
    const drinks = [drink(NOW - 10 * 3_600_000, 568, 0.05)];
    const u = user({ first_drink_at: new Date(NOW - 10 * 3_600_000).toISOString() });
    const r = estimateBAC(u, drinks);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.value).toBe(0);
  });

  it("ignores drinks logged before first_drink_at", () => {
    const u = user({ first_drink_at: new Date(NOW - 30 * 60_000).toISOString() });
    const drinks = [
      drink(NOW - 4 * 3_600_000, 568, 0.05),
      drink(NOW - 10 * 60_000, 568, 0.05),
    ];
    const r = estimateBAC(u, drinks);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    // Only the second drink should count (after session start).
    // ~0.0412 raw - 0.5h * 0.015 = ~0.0337
    expect(r.value).toBeCloseTo(0.0337, 2);
  });
});

describe("peakBAC", () => {
  it("returns missing_profile when weight is null", () => {
    const r = peakBAC(user({ weight_kg: null }), [drink(NOW, 568, 0.05)]);
    expect(r.status).toBe("missing_profile");
  });

  it("identifies the moment of peak BAC across multiple drinks", () => {
    const u = user({ first_drink_at: new Date(NOW - 2 * 3_600_000).toISOString() });
    const drinks = [
      drink(NOW - 2 * 3_600_000, 568, 0.05),
      drink(NOW - 90 * 60_000, 568, 0.05),
      drink(NOW - 5 * 60_000, 568, 0.05),
    ];
    const r = peakBAC(u, drinks);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.value).toBeGreaterThan(0);
    expect(r.atMs).not.toBeNull();
    // Peak is most likely the last drink (least decay).
    expect(r.atMs).toBe(NOW - 5 * 60_000);
  });

  it("returns zero peak for empty drinks", () => {
    const r = peakBAC(user(), []);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.value).toBe(0);
    expect(r.atMs).toBeNull();
  });
});

describe("formatBAC", () => {
  it("returns em dash for missing profile", () => {
    expect(formatBAC({ status: "missing_profile" })).toBe("—");
  });

  it("formats value to 3 decimals", () => {
    expect(formatBAC({ status: "ok", value: 0.041234 })).toBe("0.041");
  });
});
