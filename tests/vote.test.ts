import { describe, expect, it } from "vitest";
import { MIN_YES_VOTES, majorityThreshold, effectiveThreshold } from "@/lib/votes";

describe("majorityThreshold", () => {
  it("returns 1 for zero voters (floor case)", () => {
    expect(majorityThreshold(0)).toBe(1);
  });
  it("matches floor(n/2)+1 for typical group sizes", () => {
    expect(majorityThreshold(1)).toBe(1);
    expect(majorityThreshold(2)).toBe(2);
    expect(majorityThreshold(8)).toBe(5);
    expect(majorityThreshold(12)).toBe(7);
    expect(majorityThreshold(20)).toBe(11);
  });
});

describe("effectiveThreshold", () => {
  it("uses the 6-vote floor for small groups", () => {
    expect(effectiveThreshold(0)).toBe(MIN_YES_VOTES);
    expect(effectiveThreshold(4)).toBe(MIN_YES_VOTES);
    expect(effectiveThreshold(8)).toBe(MIN_YES_VOTES); // majority would be 5
  });
  it("uses the strict majority when it exceeds the floor", () => {
    expect(effectiveThreshold(12)).toBe(7);
    expect(effectiveThreshold(20)).toBe(11);
  });
  it("returns at least MIN_YES_VOTES at the crossover", () => {
    // majority(11) = 6 — same as the floor.
    expect(effectiveThreshold(11)).toBe(MIN_YES_VOTES);
    // majority(13) = 7 — now exceeds the floor.
    expect(effectiveThreshold(13)).toBe(7);
  });
});
