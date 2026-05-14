import { describe, expect, it } from "vitest";
import { evaluateAchievements, type AchievementCtx } from "@/lib/achievements";
import type {
  DrinkCategory,
  DrinkRow,
  UserRow,
  VoteItemRow,
  VoteResponseRow,
  VoteTallyRow,
} from "@/lib/supabase/types";

const PARTY_START = new Date("2026-05-14T05:00:00Z").getTime();
const PARTY_END = new Date("2026-05-15T05:00:00Z").getTime();
const T0 = new Date("2026-05-14T20:00:00Z").getTime();

function user(id: string, overrides: Partial<UserRow> = {}): UserRow {
  return {
    id,
    name: `User ${id}`,
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
  userId: string,
  loggedAtMs: number,
  category: DrinkCategory = "beer",
  volume_ml = 568,
  abv = 0.05,
): DrinkRow {
  return {
    id: `d-${userId}-${loggedAtMs}`,
    user_id: userId,
    category,
    label: null,
    volume_ml,
    abv,
    standard_drinks: (volume_ml * abv * 0.789) / 10,
    logged_at: new Date(loggedAtMs).toISOString(),
    is_saved_preset: false,
  };
}

function emptyCtx(users: UserRow[], drinks: DrinkRow[] = []): AchievementCtx {
  return {
    users,
    drinks,
    voteItems: [],
    voteResponses: [],
    voteTally: [],
    games: [],
    gamePlayers: [],
    gameScores: [],
    gameTotals: [],
    spins: [],
    photos: [],
    itineraryEvents: [],
    itineraryReactions: [],
    appOpens: [],
    windowStartMs: PARTY_START,
    windowEndMs: PARTY_END,
  };
}

function badgeFor(badges: { userId: string; id: string }[], userId: string, id: string) {
  return badges.find((b) => b.userId === userId && b.id === id);
}

describe("evaluateAchievements — drinks", () => {
  it("awards quick-off-the-mark only to the first drinker", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [
      drink("u1", T0),
      drink("u2", T0 + 30 * 60_000),
    ];
    const out = evaluateAchievements(emptyCtx([u1, u2], drinks), "live");
    expect(badgeFor(out, "u1", "quick-off-the-mark")).toBeDefined();
    expect(badgeFor(out, "u2", "quick-off-the-mark")).toBeUndefined();
  });

  it("awards marathon-runner at 10 drinks but not earlier", () => {
    const u1 = user("u1");
    const drinks9 = Array.from({ length: 9 }, (_, i) => drink("u1", T0 + i * 60_000));
    const drinks10 = Array.from({ length: 10 }, (_, i) => drink("u1", T0 + i * 60_000));
    expect(badgeFor(evaluateAchievements(emptyCtx([u1], drinks9), "live"), "u1", "marathon-runner")).toBeUndefined();
    expect(badgeFor(evaluateAchievements(emptyCtx([u1], drinks10), "live"), "u1", "marathon-runner")).toBeDefined();
  });

  it("awards centurion at 20 drinks and the-beast at 30", () => {
    const u1 = user("u1");
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => drink("u1", T0 + i * 60_000));
    const at20 = evaluateAchievements(emptyCtx([u1], make(20)), "live");
    expect(badgeFor(at20, "u1", "centurion")).toBeDefined();
    expect(badgeFor(at20, "u1", "the-beast")).toBeUndefined();
    const at30 = evaluateAchievements(emptyCtx([u1], make(30)), "live");
    expect(badgeFor(at30, "u1", "the-beast")).toBeDefined();
  });

  it("awards variety-pack only when all three categories are present", () => {
    const u1 = user("u1");
    const beerOnly = [drink("u1", T0, "beer"), drink("u1", T0 + 60_000, "wine")];
    const allThree = [
      drink("u1", T0, "beer"),
      drink("u1", T0 + 60_000, "wine"),
      drink("u1", T0 + 120_000, "spirits"),
    ];
    expect(badgeFor(evaluateAchievements(emptyCtx([u1], beerOnly), "live"), "u1", "variety-pack")).toBeUndefined();
    expect(badgeFor(evaluateAchievements(emptyCtx([u1], allThree), "live"), "u1", "variety-pack")).toBeDefined();
  });

  it("awards designated-survivor in final phase to a user who showed up but didn't drink", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [drink("u2", T0)];
    // Designated Survivor requires non-drink activity (vote/play/photo/spin) — give u1 a vote response.
    const ctx: AchievementCtx = {
      ...emptyCtx([u1, u2], drinks),
      voteItems: [
        { id: "v1", proposer_id: "u2", text: "Round?", created_at: new Date(T0).toISOString(), passed_at: null, rejected_at: null, repeals_vote_item_id: null, repealed_at: null },
      ],
      voteResponses: [
        { vote_item_id: "v1", user_id: "u1", value: 1, updated_at: new Date(T0).toISOString() },
      ],
    };
    const final = evaluateAchievements(ctx, "final");
    expect(badgeFor(final, "u1", "designated-survivor")).toBeDefined();
    expect(badgeFor(final, "u2", "designated-survivor")).toBeUndefined();
  });

  it("does not award designated-survivor in live phase", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [drink("u2", T0)];
    const live = evaluateAchievements(emptyCtx([u1, u2], drinks), "live");
    expect(badgeFor(live, "u1", "designated-survivor")).toBeUndefined();
  });

  it("awards bookends in final phase to the user with both first and last drink", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [
      drink("u1", T0),
      drink("u2", T0 + 30 * 60_000),
      drink("u1", T0 + 2 * 3_600_000),
    ];
    const final = evaluateAchievements(emptyCtx([u1, u2], drinks), "final");
    expect(badgeFor(final, "u1", "bookends")).toBeDefined();
    expect(badgeFor(final, "u2", "bookends")).toBeUndefined();
  });

  it("awards in-sync when two users log within 60 seconds of each other", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [drink("u1", T0), drink("u2", T0 + 30_000)];
    const out = evaluateAchievements(emptyCtx([u1, u2], drinks), "live");
    expect(badgeFor(out, "u1", "in-sync")).toBeDefined();
    expect(badgeFor(out, "u2", "in-sync")).toBeDefined();
  });

  it("does not award in-sync when drinks are more than 60s apart", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const drinks = [drink("u1", T0), drink("u2", T0 + 120_000)];
    const out = evaluateAchievements(emptyCtx([u1, u2], drinks), "live");
    expect(badgeFor(out, "u1", "in-sync")).toBeUndefined();
  });

  it("awards pacesetter for 5 drinks within a 60-min window", () => {
    const u1 = user("u1");
    const drinks = Array.from({ length: 5 }, (_, i) =>
      drink("u1", T0 + i * 10 * 60_000),
    );
    const out = evaluateAchievements(emptyCtx([u1], drinks), "live");
    expect(badgeFor(out, "u1", "pacesetter")).toBeDefined();
  });
});

describe("evaluateAchievements — votes", () => {
  it("awards wallflower in final phase to a user who did not vote at all", () => {
    const u1 = user("u1");
    const u2 = user("u2");
    const voteItems: VoteItemRow[] = [
      {
        id: "v1",
        proposer_id: "u2",
        text: "Shots for everyone",
        created_at: new Date(T0).toISOString(),
        passed_at: null,
        rejected_at: null,
        repeals_vote_item_id: null,
        repealed_at: null,
      },
    ];
    const voteResponses: VoteResponseRow[] = [
      { vote_item_id: "v1", user_id: "u2", value: 1, updated_at: new Date(T0).toISOString() },
    ];
    const voteTally: VoteTallyRow[] = [
      {
        id: "v1",
        text: "Shots for everyone",
        proposer_id: "u2",
        created_at: new Date(T0).toISOString(),
        for_count: 1,
        against_count: 0,
        net: 1,
      },
    ];
    const ctx: AchievementCtx = {
      ...emptyCtx([u1, u2]),
      voteItems,
      voteResponses,
      voteTally,
    };
    const out = evaluateAchievements(ctx, "final");
    expect(badgeFor(out, "u1", "wallflower")).toBeDefined();
    expect(badgeFor(out, "u2", "wallflower")).toBeUndefined();
  });
});
