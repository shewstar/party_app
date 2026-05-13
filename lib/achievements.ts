import type {
  AppOpenRow,
  CameraPhotoRow,
  DrinkRow,
  GamePlayerRow,
  GameRow,
  GameScoreRow,
  GameTotalsRow,
  ItineraryEventRow,
  ItineraryReactionRow,
  SpinRow,
  UserRow,
  VoteItemRow,
  VoteResponseRow,
  VoteTallyRow,
} from "./supabase/types";
import { peakBAC } from "./bac";
import { fastestPace, gameWinsByUser } from "./recap";

export type Tier = "win" | "fail" | "fun";
export type Timing = "live" | "endOfDay";

export type Achievement = {
  id: string;
  title: string;
  blurb: string;
  icon: string;
  tier: Tier;
  timing: Timing;
};

export type EarnedBadge = Achievement & {
  userId: string;
  key: string;
  detail?: string;
  earnedAtMs?: number;
};

export type AchievementCtx = {
  users: UserRow[];
  drinks: DrinkRow[];
  voteItems: VoteItemRow[];
  voteResponses: VoteResponseRow[];
  voteTally: VoteTallyRow[];
  games: GameRow[];
  gamePlayers: GamePlayerRow[];
  gameScores: GameScoreRow[];
  gameTotals: GameTotalsRow[];
  spins: SpinRow[];
  photos: CameraPhotoRow[];
  itineraryEvents: ItineraryEventRow[];
  itineraryReactions: ItineraryReactionRow[];
  appOpens: AppOpenRow[];
  windowStartMs: number;
  windowEndMs: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Drinks — live
  { id: "quick-off-the-mark", title: "Quick Off the Mark", blurb: "First drink of the night.", icon: "🚀", tier: "win", timing: "live" },
  { id: "marathon-runner", title: "Marathon Runner", blurb: "10+ drinks in one night.", icon: "🏗️", tier: "win", timing: "live" },
  { id: "pacesetter", title: "Pacesetter", blurb: "5 drinks in a 60-min window.", icon: "⚡", tier: "win", timing: "live" },
  { id: "variety-pack", title: "Variety Pack", blurb: "Drank beer, wine, and spirits.", icon: "🥃", tier: "fun", timing: "live" },
  { id: "night-owl", title: "Night Owl", blurb: "Drink logged after 2am.", icon: "🌅", tier: "fun", timing: "live" },
  { id: "late-starter", title: "Late Starter", blurb: "First drink after 10pm.", icon: "🦇", tier: "fun", timing: "live" },
  { id: "cheers-club", title: "Cheers Club", blurb: "Matched another buck's drink.", icon: "🍻", tier: "fun", timing: "live" },
  { id: "in-sync", title: "In Sync", blurb: "Logged a drink within 60s of another buck.", icon: "🥂", tier: "fun", timing: "live" },
  { id: "drinking-buddy", title: "Drinking Buddy", blurb: "Matched 3+ different drinks with other bucks.", icon: "👯", tier: "win", timing: "live" },
  { id: "creature-of-habit", title: "Creature of Habit", blurb: "Drank the same drink 3+ times.", icon: "🦎", tier: "win", timing: "live" },
  { id: "double-down", title: "Double Down", blurb: "Two drinks logged within 5 minutes.", icon: "🃏", tier: "fun", timing: "live" },
  // Drinks — end-of-day
  { id: "heavyweight", title: "Heavyweight", blurb: "Most standard drinks of the night.", icon: "🧱", tier: "win", timing: "endOfDay" },
  { id: "light-touch", title: "Light Touch", blurb: "3+ drinks, every one under 4% ABV.", icon: "🍃", tier: "fun", timing: "endOfDay" },
  { id: "bookends", title: "Bookends", blurb: "First and last drink of the night.", icon: "🌗", tier: "win", timing: "endOfDay" },
  { id: "peak-performer", title: "Peak Performer", blurb: "Highest peak BAC of the night.", icon: "📈", tier: "win", timing: "endOfDay" },
  { id: "pacing-yourself", title: "Pacing Yourself", blurb: "Only 1–2 drinks all night.", icon: "🐢", tier: "fail", timing: "endOfDay" },
  { id: "designated-survivor", title: "Designated Survivor", blurb: "No drinks logged tonight.", icon: "🥛", tier: "fail", timing: "endOfDay" },
  { id: "one-and-done", title: "One and Done", blurb: "One early drink, then nothing.", icon: "💧", tier: "fail", timing: "endOfDay" },

  // Votes — live
  { id: "activist", title: "Activist", blurb: "Proposed 3+ ideas.", icon: "📢", tier: "win", timing: "live" },
  { id: "landslide", title: "Landslide", blurb: "Proposal won big with zero against.", icon: "🤝", tier: "win", timing: "live" },
  // Votes — end-of-day
  { id: "rule-maker", title: "Rule Maker", blurb: "Your proposal passed.", icon: "👑", tier: "win", timing: "endOfDay" },
  { id: "democracy", title: "Democracy!", blurb: "Voted on every proposal.", icon: "🗳️", tier: "win", timing: "endOfDay" },
  { id: "sad-trombone", title: "Sad Trombone", blurb: "Your proposal got voted down.", icon: "💔", tier: "fail", timing: "endOfDay" },
  { id: "naysayer", title: "Naysayer", blurb: "More against votes than for.", icon: "🙅", tier: "fail", timing: "endOfDay" },
  { id: "wallflower", title: "Wallflower", blurb: "Didn't vote on a single thing.", icon: "🐭", tier: "fail", timing: "endOfDay" },

  // Games — live
  { id: "clutch", title: "Clutch", blurb: "Won a finished game by exactly 1 point.", icon: "🎯", tier: "win", timing: "endOfDay" },
  { id: "triathlete", title: "Triathlete", blurb: "Joined 3+ games.", icon: "🎮", tier: "win", timing: "live" },
  { id: "gauntlet", title: "Gauntlet", blurb: "Joined 10+ games.", icon: "🕹️", tier: "win", timing: "live" },
  { id: "net-negative", title: "Net Negative", blurb: "Game score dropped below zero.", icon: "🤡", tier: "fail", timing: "live" },
  // Games — end-of-day
  { id: "game-champion", title: "Game Champion", blurb: "Most game wins tonight.", icon: "🏆", tier: "win", timing: "endOfDay" },
  { id: "sweeper", title: "Sweeper", blurb: "Won every game you played.", icon: "🥇", tier: "win", timing: "endOfDay" },
  { id: "wooden-spoon", title: "Wooden Spoon", blurb: "Finished last in a game.", icon: "🥉", tier: "fail", timing: "endOfDay" },
  { id: "bagel", title: "Bagel", blurb: "Zero points in a finished game.", icon: "0️⃣", tier: "fail", timing: "endOfDay" },

  // Spin — live
  { id: "chosen-one", title: "Chosen One", blurb: "Picked by the wheel.", icon: "🎡", tier: "fun", timing: "live" },
  { id: "magnet", title: "Magnet", blurb: "Picked 3+ times tonight.", icon: "🎯", tier: "fun", timing: "live" },
  { id: "spinmeister", title: "Spinmeister", blurb: "Spun the wheel 5+ times.", icon: "🌪️", tier: "fun", timing: "live" },
  { id: "stacked-odds", title: "Stacked Odds", blurb: "Picked 10+ times in pools of 5+ bucks.", icon: "🎰", tier: "win", timing: "live" },
  // Spin — end-of-day
  { id: "ghosted", title: "Ghosted", blurb: "In 5+ pools, picked zero times.", icon: "👻", tier: "fail", timing: "endOfDay" },

  // Camera — live
  { id: "film-loaded", title: "Film Loaded", blurb: "Took your first shot.", icon: "🎞", tier: "fun", timing: "live" },
  { id: "shutterbug", title: "Shutterbug", blurb: "Used all 3 daily shots.", icon: "📸", tier: "win", timing: "live" },
  { id: "both-filters", title: "Both Filters", blurb: "Got a warm AND a cool shot.", icon: "🎨", tier: "fun", timing: "live" },
  // Camera — end-of-day
  { id: "cool-eye", title: "Cool Eye", blurb: "Every photo came out cool.", icon: "❄️", tier: "fun", timing: "endOfDay" },
  { id: "warm-eye", title: "Warm Eye", blurb: "Every photo came out warm.", icon: "🥵", tier: "fun", timing: "endOfDay" },
  { id: "no-pic-no-proof", title: "No Pic No Proof", blurb: "Took zero photos tonight.", icon: "🚫", tier: "fail", timing: "endOfDay" },

  // Itinerary — live
  { id: "hype-buck", title: "Hype Buck", blurb: "Reacted to 3+ itinerary events.", icon: "📣", tier: "win", timing: "live" },
  { id: "trendsetter", title: "Trendsetter", blurb: "First to react to an event.", icon: "✨", tier: "fun", timing: "live" },
  { id: "doom-buck", title: "Doom Buck", blurb: "Dropped the 💀 reaction.", icon: "💀", tier: "fun", timing: "live" },
  { id: "reaction-czar", title: "Reaction Czar", blurb: "Used all 6 emoji reactions.", icon: "🌈", tier: "win", timing: "live" },
  { id: "punctual", title: "Punctual", blurb: "Reacted within 10 min of an event being posted.", icon: "⏱️", tier: "fun", timing: "live" },
  // Itinerary — end-of-day
  { id: "hyped-up", title: "Hyped Up", blurb: "Reacted to every event tonight.", icon: "🎉", tier: "win", timing: "endOfDay" },

  // App opens — live
  { id: "early-bird", title: "Early Bird", blurb: "First buck to open the app today.", icon: "🌅", tier: "win", timing: "live" },
  { id: "refresher", title: "Refresher", blurb: "Opened the app 10+ times tonight.", icon: "🔄", tier: "fun", timing: "live" },
  { id: "locked-in", title: "Locked In", blurb: "Opened the app 100+ times tonight.", icon: "🔒", tier: "fun", timing: "live" },
  // App opens — end-of-day
  { id: "last-light", title: "Last Light", blurb: "Last open of the night.", icon: "🌙", tier: "fun", timing: "endOfDay" },

  // Gold-tier drinks
  { id: "centurion", title: "Centurion", blurb: "20+ drinks in one night.", icon: "💯", tier: "win", timing: "live" },
  { id: "the-beast", title: "The Beast", blurb: "30+ drinks in one night.", icon: "🦏", tier: "win", timing: "live" },
  { id: "strong-hand", title: "Strong Hand", blurb: "Any 5 drinks in a row averaging ≥ 1.3 std.", icon: "💪", tier: "win", timing: "live" },
  { id: "speed-demon", title: "Speed Demon", blurb: "8 drinks inside a 60-min window.", icon: "💨", tier: "win", timing: "live" },
  { id: "iron-liver", title: "Iron Liver", blurb: "Peak BAC over 0.20.", icon: "🛡️", tier: "win", timing: "endOfDay" },

  // Gold-tier votes / games / spin
  { id: "visionary", title: "Visionary", blurb: "Proposed 10+ ideas.", icon: "📜", tier: "win", timing: "endOfDay" },
  { id: "dynasty", title: "Dynasty", blurb: "Won 5+ finished games.", icon: "🏛️", tier: "win", timing: "endOfDay" },
  { id: "untouchable", title: "Untouchable", blurb: "Won a finished game by 10+ points.", icon: "⚔️", tier: "win", timing: "endOfDay" },
  { id: "four-leaf", title: "Four Leaf", blurb: "Picked by the wheel 5+ times.", icon: "🍀", tier: "win", timing: "live" },

  // Cross-feature — live
  { id: "renaissance-buck", title: "Renaissance Buck", blurb: "Drank, voted, played, snapped.", icon: "🎭", tier: "win", timing: "live" },
  { id: "hot-streak", title: "Hot Streak", blurb: "Peak BAC > 0.10 and winning a game.", icon: "🔥", tier: "win", timing: "live" },
  // Cross-feature — end-of-day
  { id: "triple-crown", title: "Triple Crown", blurb: "Heavyweight + Champion + Rule Maker.", icon: "🌟", tier: "win", timing: "endOfDay" },
  { id: "iron-man", title: "Iron Man", blurb: "Centurion + Iron Liver + Dynasty.", icon: "🦾", tier: "win", timing: "endOfDay" },
  { id: "ice-cold", title: "Ice Cold", blurb: "Sober but still won a game.", icon: "🧊", tier: "win", timing: "endOfDay" },
  { id: "no-show", title: "No Show", blurb: "Crickets all night.", icon: "🫥", tier: "fail", timing: "endOfDay" },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

function make(
  id: string,
  userId: string,
  detail?: string,
  suffix?: string,
  at?: number,
): EarnedBadge {
  const a = byId.get(id);
  if (!a) throw new Error(`Unknown achievement: ${id}`);
  const key = suffix ? `${id}:${suffix}` : id;
  return { ...a, userId, key, detail, earnedAtMs: at };
}

export function evaluateAchievements(
  ctx: AchievementCtx,
  phase: "live" | "final",
): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  for (const u of ctx.users) {
    out.push(...earnedForUser(ctx, u.id, phase));
  }
  return out;
}

export function earnedForUser(
  ctx: AchievementCtx,
  userId: string,
  phase: "live" | "final",
): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  const wantLive = true;
  const wantEnd = phase === "final";

  const userLatestMs = lastUserActivityMs(ctx, userId);

  const userDrinks = ctx.drinks.filter((d) => d.user_id === userId);
  const drinkCount = userDrinks.length;
  const totalStd = userDrinks.reduce((s, d) => s + Number(d.standard_drinks), 0);
  const userTimes = userDrinks.map((d) => new Date(d.logged_at).getTime());
  const sortedDrinkTimes = [...userTimes].sort((a, b) => a - b);
  const firstDrinkMs = userTimes.length ? Math.min(...userTimes) : null;
  const lastDrinkMs = userTimes.length ? Math.max(...userTimes) : null;
  const endOfPartyMs = lastDrinkMs ?? userLatestMs ?? ctx.windowEndMs;

  // ── DRINKS (live) ──────────────────────────────────────────────────────
  if (wantLive) {
    if (firstDrinkMs !== null) {
      const earliest = Math.min(
        ...ctx.drinks.map((d) => new Date(d.logged_at).getTime()),
      );
      if (firstDrinkMs === earliest) {
        out.push(make("quick-off-the-mark", userId, "first drink of the night", undefined, firstDrinkMs));
      }
    }
    if (drinkCount >= 10) {
      out.push(make("marathon-runner", userId, `${drinkCount} drinks`, undefined, sortedDrinkTimes[9]));
    }
    if (drinkCount >= 20) {
      out.push(make("centurion", userId, `${drinkCount} drinks`, undefined, sortedDrinkTimes[19]));
    }
    if (drinkCount >= 30) {
      out.push(make("the-beast", userId, `${drinkCount} drinks`, undefined, sortedDrinkTimes[29]));
    }
    // Sliding window of 5 consecutive drinks (chronological). Picks the best
    // 5-in-a-row so a strong stretch isn't diluted by lighter drinks earlier
    // or later in the night.
    if (drinkCount >= 5) {
      const drinksByTime = [...userDrinks].sort(
        (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
      );
      let bestAvg = 0;
      let bestEndIdx = -1;
      for (let i = 4; i < drinksByTime.length; i++) {
        let windowSum = 0;
        for (let j = i - 4; j <= i; j++) windowSum += Number(drinksByTime[j].standard_drinks);
        const avg = windowSum / 5;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestEndIdx = i;
        }
      }
      if (bestAvg >= 1.3) {
        const earnedAt = new Date(drinksByTime[bestEndIdx].logged_at).getTime();
        out.push(make("strong-hand", userId, `${bestAvg.toFixed(2)} std avg`, undefined, earnedAt));
      }
    }
    const pace = fastestPace(userDrinks);
    if (pace >= 5) {
      out.push(make("pacesetter", userId, `${pace} in 60 min`, undefined, lastDrinkMs ?? undefined));
    }
    if (pace >= 8) {
      out.push(make("speed-demon", userId, `${pace} in 60 min`, undefined, lastDrinkMs ?? undefined));
    }
    const seenCats = new Set<string>();
    let varietyAtMs: number | undefined;
    for (const d of userDrinks.slice().sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())) {
      seenCats.add(d.category);
      if (seenCats.size === 3) {
        varietyAtMs = new Date(d.logged_at).getTime();
        break;
      }
    }
    if (varietyAtMs !== undefined) {
      out.push(make("variety-pack", userId, "beer + wine + spirits", undefined, varietyAtMs));
    }
    // Per-trigger: one Night Owl per post-2am drink.
    for (const d of userDrinks) {
      const h = new Date(d.logged_at).getHours();
      if (h >= 2 && h < 5) {
        out.push(make("night-owl", userId, "after 2am", d.id, new Date(d.logged_at).getTime()));
      }
    }

    if (firstDrinkMs !== null) {
      const h = new Date(firstDrinkMs).getHours();
      if (h >= 22 || h < 5) {
        out.push(make("late-starter", userId, "first drink late", undefined, firstDrinkMs));
      }
    }
    const myLabels = new Set(
      userDrinks.map((d) => d.label).filter((l): l is string => !!l),
    );
    if (myLabels.size > 0) {
      // Per-trigger: one Cheers Club per matching user drink.
      for (const d of userDrinks) {
        if (!d.label) continue;
        const matched = ctx.drinks.some(
          (x) => x.user_id !== userId && x.label === d.label,
        );
        if (matched) {
          out.push(make("cheers-club", userId, d.label, d.id, new Date(d.logged_at).getTime()));
        }
      }
      const sharedLabels = new Set<string>();
      for (const lbl of myLabels) {
        if (ctx.drinks.some((d) => d.user_id !== userId && d.label === lbl)) {
          sharedLabels.add(lbl);
        }
      }
      if (sharedLabels.size >= 3) {
        out.push(make("drinking-buddy", userId, `${sharedLabels.size} shared`, undefined, lastDrinkMs ?? undefined));
      }
    }
    const SIXTY_SEC = 60 * 1000;
    // Per-trigger: one In Sync per user drink that lands within 60s of another buck's.
    for (const my of userDrinks) {
      const myT = new Date(my.logged_at).getTime();
      const match = ctx.drinks.some(
        (d) =>
          d.user_id !== userId &&
          Math.abs(new Date(d.logged_at).getTime() - myT) <= SIXTY_SEC,
      );
      if (match) {
        out.push(make("in-sync", userId, "within 60s", my.id, myT));
      }
    }

    const labelCountsMap = new Map<string, { count: number; thirdAt?: number }>();
    for (const d of userDrinks.slice().sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())) {
      if (!d.label) continue;
      const entry = labelCountsMap.get(d.label) ?? { count: 0 };
      entry.count++;
      if (entry.count === 3) entry.thirdAt = new Date(d.logged_at).getTime();
      labelCountsMap.set(d.label, entry);
    }
    for (const [lbl, info] of labelCountsMap) {
      if (info.count >= 3) {
        out.push(make("creature-of-habit", userId, `${lbl} ×${info.count}`, undefined, info.thirdAt));
        break;
      }
    }

    // Per-trigger: one Double Down per ≤5min consecutive pair.
    const drinksByTime = [...userDrinks].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
    );
    for (let i = 1; i < drinksByTime.length; i++) {
      const cur = new Date(drinksByTime[i].logged_at).getTime();
      const prev = new Date(drinksByTime[i - 1].logged_at).getTime();
      if (cur - prev <= 5 * 60 * 1000) {
        out.push(make("double-down", userId, `≤5 min apart`, drinksByTime[i].id, cur));
      }
    }
  }

  // ── DRINKS (end-of-day) ────────────────────────────────────────────────
  if (wantEnd) {
    const stdByUser = new Map<string, number>();
    for (const d of ctx.drinks) {
      stdByUser.set(
        d.user_id,
        (stdByUser.get(d.user_id) ?? 0) + Number(d.standard_drinks),
      );
    }
    const topStd = [...stdByUser.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topStd && topStd[0] === userId && topStd[1] > 0) {
      out.push(make("heavyweight", userId, `${topStd[1].toFixed(1)} std`, undefined, endOfPartyMs));
    }

    const user = ctx.users.find((u) => u.id === userId);
    if (user && userDrinks.length > 0) {
      const sessionStart = Math.min(...userTimes);
      const me = peakBAC(user, userDrinks, sessionStart);
      let topUserId: string | null = null;
      let topVal = 0;
      for (const u of ctx.users) {
        const ud = ctx.drinks.filter((d) => d.user_id === u.id);
        if (ud.length === 0) continue;
        const ss = Math.min(...ud.map((d) => new Date(d.logged_at).getTime()));
        const p = peakBAC(u, ud, ss);
        if (p.status === "ok" && p.value > topVal) {
          topVal = p.value;
          topUserId = u.id;
        }
      }
      if (topUserId === userId && me.status === "ok" && me.value > 0) {
        out.push(make("peak-performer", userId, me.value.toFixed(3), undefined, me.atMs ?? endOfPartyMs));
      }
      if (me.status === "ok" && me.value > 0.2) {
        out.push(make("iron-liver", userId, me.value.toFixed(3), undefined, me.atMs ?? endOfPartyMs));
      }
    }

    if (drinkCount === 1 || drinkCount === 2) {
      out.push(make("pacing-yourself", userId, `${drinkCount} drink${drinkCount === 1 ? "" : "s"}`, undefined, endOfPartyMs));
    }
    // Designated Survivor + No Show distinguish: Survivor = did SOMETHING but no drinks.
    // No Show handled in cross-feature.
    const didSomethingNonDrink = activityFlags(ctx, userId).nonDrink;
    if (drinkCount === 0 && didSomethingNonDrink) {
      out.push(make("designated-survivor", userId, undefined, undefined, endOfPartyMs));
    }
    if (drinkCount === 1 && firstDrinkMs !== null) {
      const h = new Date(firstDrinkMs).getHours();
      const earlyHour = h >= 5 && h < 21;
      if (earlyHour) out.push(make("one-and-done", userId, "before 9pm", undefined, firstDrinkMs));
    }
    if (drinkCount >= 3 && userDrinks.every((d) => Number(d.abv) < 0.04)) {
      out.push(make("light-touch", userId, "all <4% abv", undefined, lastDrinkMs ?? undefined));
    }
    if (drinkCount >= 1 && ctx.drinks.length >= 2 && firstDrinkMs !== null && lastDrinkMs !== null) {
      const allTimes = ctx.drinks.map((d) => new Date(d.logged_at).getTime());
      const earliestAll = Math.min(...allTimes);
      const latestAll = Math.max(...allTimes);
      if (
        firstDrinkMs === earliestAll &&
        lastDrinkMs === latestAll &&
        earliestAll !== latestAll
      ) {
        out.push(make("bookends", userId, "first & last", undefined, lastDrinkMs));
      }
    }
  }

  // ── VOTES ──────────────────────────────────────────────────────────────
  const myProposals = ctx.voteItems.filter((i) => i.proposer_id === userId);
  const myProposalTimes = myProposals
    .map((p) => new Date(p.created_at).getTime())
    .sort((a, b) => a - b);
  const myTally = ctx.voteTally.filter((t) =>
    myProposals.some((p) => p.id === t.id),
  );
  const myResponses = ctx.voteResponses.filter((r) => r.user_id === userId);
  const myResponseTimes = myResponses
    .map((r) => new Date(r.updated_at).getTime())
    .sort((a, b) => a - b);
  const lastResponseMs = myResponseTimes.length ? myResponseTimes[myResponseTimes.length - 1] : undefined;
  const lastProposalMs = myProposalTimes.length ? myProposalTimes[myProposalTimes.length - 1] : undefined;
  // Latest activity in the votes domain (proposed or responded).
  const lastVoteActivityMs = (() => {
    const candidates = [lastResponseMs, lastProposalMs].filter((x): x is number => x !== undefined);
    return candidates.length ? Math.max(...candidates) : undefined;
  })();
  function tallyResponseMs(itemId: string, predicate: (v: 1 | -1) => boolean): number | undefined {
    const ts = ctx.voteResponses
      .filter((r) => r.vote_item_id === itemId && predicate(r.value))
      .map((r) => new Date(r.updated_at).getTime());
    return ts.length ? Math.max(...ts) : undefined;
  }
  if (wantLive) {
    if (myProposals.length >= 3) {
      out.push(make("activist", userId, `${myProposals.length} proposals`, undefined, myProposalTimes[2]));
    }
    for (const t of myTally) {
      if (t.net >= 3 && t.against_count === 0) {
        out.push(make("landslide", userId, `+${t.net}`, t.id, tallyResponseMs(t.id, () => true) ?? lastVoteActivityMs));
        break;
      }
    }
  }
  if (wantEnd) {
    if (myTally.some((t) => t.net > 0)) {
      const best = myTally.reduce((a, b) => (a.net >= b.net ? a : b));
      out.push(make("rule-maker", userId, `+${best.net}`, undefined, tallyResponseMs(best.id, () => true) ?? endOfPartyMs));
    }
    if (myProposals.length >= 10) {
      out.push(make("visionary", userId, `${myProposals.length} proposals`, undefined, myProposalTimes[9]));
    }
    if (myTally.some((t) => t.net < 0)) {
      const worst = myTally.reduce((a, b) => (a.net <= b.net ? a : b));
      out.push(make("sad-trombone", userId, `${worst.net}`, undefined, tallyResponseMs(worst.id, () => true) ?? endOfPartyMs));
    }
    if (ctx.voteItems.length > 0) {
      if (myResponses.length === ctx.voteItems.length && myResponses.length > 0) {
        out.push(make("democracy", userId, `voted ${myResponses.length}/${ctx.voteItems.length}`, undefined, lastResponseMs ?? endOfPartyMs));
      }
      if (myResponses.length === 0) {
        out.push(make("wallflower", userId, undefined, undefined, endOfPartyMs));
      }
    }
    const forCount = myResponses.filter((r) => r.value === 1).length;
    const againstCount = myResponses.filter((r) => r.value === -1).length;
    if (againstCount > forCount && againstCount >= 2) {
      const lastAgainst = myResponses
        .filter((r) => r.value === -1)
        .map((r) => new Date(r.updated_at).getTime())
        .sort((a, b) => a - b);
      out.push(make("naysayer", userId, `${againstCount} against`, undefined, lastAgainst[lastAgainst.length - 1] ?? endOfPartyMs));
    }
  }

  // ── GAMES ──────────────────────────────────────────────────────────────
  const myGames = ctx.gamePlayers.filter((gp) => gp.user_id === userId);
  const myGameIds = new Set(myGames.map((g) => g.game_id));
  const myGameTotals = ctx.gameTotals.filter((t) => t.user_id === userId);
  // Earliest moment each of the user's games "started" for them: their first
  // score in it, or the game's created_at as a fallback.
  function gameStartForMe(gameId: string): number {
    const myScores = ctx.gameScores
      .filter((s) => s.game_id === gameId && s.user_id === userId)
      .map((s) => new Date(s.recorded_at).getTime());
    if (myScores.length) return Math.min(...myScores);
    const game = ctx.games.find((g) => g.id === gameId);
    return game ? new Date(game.created_at).getTime() : (userLatestMs ?? ctx.windowEndMs);
  }
  function gameLastActivityMs(gameId: string): number {
    const scores = ctx.gameScores
      .filter((s) => s.game_id === gameId)
      .map((s) => new Date(s.recorded_at).getTime());
    if (scores.length) return Math.max(...scores);
    const game = ctx.games.find((g) => g.id === gameId);
    return game ? new Date(game.created_at).getTime() : (userLatestMs ?? ctx.windowEndMs);
  }
  const myGameStartTimes = [...myGameIds].map(gameStartForMe).sort((a, b) => a - b);
  const lastGameActivityForMe = (() => {
    const ts = [...myGameIds].map(gameLastActivityMs);
    return ts.length ? Math.max(...ts) : undefined;
  })();
  if (wantLive) {
    if (myGames.length >= 3) {
      out.push(make("triathlete", userId, `${myGames.length} games`, undefined, myGameStartTimes[2]));
    }
    if (myGames.length >= 10) {
      out.push(make("gauntlet", userId, `${myGames.length} games`, undefined, myGameStartTimes[9]));
    }
    const negative = myGameTotals.find((t) => Number(t.total_score) < 0);
    if (negative) {
      out.push(make("net-negative", userId, undefined, undefined, gameLastActivityMs(negative.game_id)));
    }
  }
  if (wantEnd) {
    const finishedGameIds = new Set(
      ctx.games.filter((g) => g.finished).map((g) => g.id),
    );
    const finishedTotals = ctx.gameTotals.filter((t) =>
      finishedGameIds.has(t.game_id),
    );
    const myFinishedGameIds = new Set(
      [...myGameIds].filter((id) => finishedGameIds.has(id)),
    );
    const lastFinishedGameMs = (() => {
      const ts = [...finishedGameIds].map(gameLastActivityMs);
      return ts.length ? Math.max(...ts) : endOfPartyMs;
    })();

    const wins = gameWinsByUser(finishedTotals);
    const myWins = wins.find((r) => r.user_id === userId);
    const topWins = [...wins].sort((a, b) => b.wins - a.wins || b.total - a.total)[0];
    if (topWins && topWins.user_id === userId && topWins.wins > 0) {
      out.push(make("game-champion", userId, `${topWins.wins} W`, undefined, lastFinishedGameMs));
    }
    if (myWins && myWins.wins >= 5) {
      out.push(make("dynasty", userId, `${myWins.wins} W`, undefined, lastFinishedGameMs));
    }
    if (myFinishedGameIds.size >= 2) {
      const wonAll = [...myFinishedGameIds].every((gameId) => {
        const totals = finishedTotals.filter((t) => t.game_id === gameId);
        if (totals.length < 2) return false;
        const top = [...totals].sort(
          (a, b) => Number(b.total_score) - Number(a.total_score),
        )[0];
        return top.user_id === userId && Number(top.total_score) > 0;
      });
      if (wonAll) out.push(make("sweeper", userId, `${myFinishedGameIds.size} games`, undefined, lastFinishedGameMs));
    }
    for (const gameId of myFinishedGameIds) {
      const totals = finishedTotals.filter((t) => t.game_id === gameId);
      if (totals.length < 3) continue;
      const sorted = [...totals].sort(
        (a, b) => Number(a.total_score) - Number(b.total_score),
      );
      if (sorted[0].user_id === userId && Number(sorted[0].total_score) <= 0) {
        out.push(make("wooden-spoon", userId, "last place", gameId, gameLastActivityMs(gameId)));
        break;
      }
    }
    for (const t of myGameTotals) {
      if (!finishedGameIds.has(t.game_id)) continue;
      if (Number(t.total_score) === 0) {
        const totals = finishedTotals.filter((x) => x.game_id === t.game_id);
        if (totals.length >= 2) {
          out.push(make("bagel", userId, "0 pts", t.game_id, gameLastActivityMs(t.game_id)));
          break;
        }
      }
    }
    for (const gameId of myFinishedGameIds) {
      const totals = finishedTotals.filter((t) => t.game_id === gameId);
      if (totals.length < 2) continue;
      const sorted = [...totals].sort(
        (a, b) => Number(b.total_score) - Number(a.total_score),
      );
      if (sorted[0].user_id !== userId) continue;
      const margin = Number(sorted[0].total_score) - Number(sorted[1].total_score);
      if (margin === 1) {
        out.push(make("clutch", userId, "won by 1", gameId, gameLastActivityMs(gameId)));
        break;
      }
    }
    for (const gameId of myFinishedGameIds) {
      const totals = finishedTotals.filter((t) => t.game_id === gameId);
      if (totals.length < 2) continue;
      const sorted = [...totals].sort(
        (a, b) => Number(b.total_score) - Number(a.total_score),
      );
      if (
        sorted[0].user_id === userId &&
        Number(sorted[0].total_score) - Number(sorted[1].total_score) >= 10
      ) {
        out.push(
          make(
            "untouchable",
            userId,
            `+${Number(sorted[0].total_score) - Number(sorted[1].total_score)}`,
            gameId,
            gameLastActivityMs(gameId),
          ),
        );
        break;
      }
    }
    if (myWins && myWins.wins === 0 && myGames.length >= 1) {
      // not used; ice-cold below covers sober-game-winner
    }
  }

  // ── SPIN ───────────────────────────────────────────────────────────────
  const wonSpins = ctx.spins.filter((s) => s.winner_id === userId);
  const wonSpinTimes = wonSpins.map((s) => new Date(s.created_at).getTime()).sort((a, b) => a - b);
  const spunByMe = ctx.spins.filter((s) => s.spinner_id === userId);
  const spunByMeTimes = spunByMe.map((s) => new Date(s.created_at).getTime()).sort((a, b) => a - b);
  const pooledSpins = ctx.spins.filter((s) => s.pool.includes(userId));
  const pooledSpinTimes = pooledSpins.map((s) => new Date(s.created_at).getTime()).sort((a, b) => a - b);
  const lastPooledMs = pooledSpinTimes.length ? pooledSpinTimes[pooledSpinTimes.length - 1] : undefined;
  if (wantLive) {
    // Per-trigger: one Chosen One per spin won.
    for (const s of wonSpins) {
      out.push(make("chosen-one", userId, undefined, s.id, new Date(s.created_at).getTime()));
    }
    if (wonSpins.length >= 3) {
      out.push(make("magnet", userId, `${wonSpins.length}× picked`, undefined, wonSpinTimes[2]));
    }
    if (wonSpins.length >= 5) {
      out.push(make("four-leaf", userId, `${wonSpins.length}× picked`, undefined, wonSpinTimes[4]));
    }
    const bigPoolWinsArr = wonSpins
      .filter((s) => s.pool.length > 4)
      .map((s) => new Date(s.created_at).getTime())
      .sort((a, b) => a - b);
    if (bigPoolWinsArr.length >= 10) {
      out.push(make("stacked-odds", userId, `${bigPoolWinsArr.length}× in 5+ pools`, undefined, bigPoolWinsArr[9]));
    }
    if (spunByMe.length >= 5) {
      out.push(make("spinmeister", userId, `${spunByMe.length} spins`, undefined, spunByMeTimes[4]));
    }
  }
  if (wantEnd) {
    if (pooledSpins.length >= 5 && wonSpins.length === 0) {
      out.push(make("ghosted", userId, `${pooledSpins.length} pools, 0 picks`, undefined, lastPooledMs ?? endOfPartyMs));
    }
  }

  // ── CAMERA ─────────────────────────────────────────────────────────────
  const myPhotos = ctx.photos.filter((p) => p.user_id === userId);
  const myPhotoTimes = myPhotos.map((p) => new Date(p.taken_at).getTime()).sort((a, b) => a - b);
  const lastPhotoMs = myPhotoTimes.length ? myPhotoTimes[myPhotoTimes.length - 1] : undefined;
  const warmPhotos = myPhotos.filter((p) => p.filter_variant === "warm");
  const coolPhotos = myPhotos.filter((p) => p.filter_variant === "cool");
  const warmCount = warmPhotos.length;
  const coolCount = coolPhotos.length;
  if (wantLive) {
    if (myPhotos.length >= 1) out.push(make("film-loaded", userId, undefined, undefined, myPhotoTimes[0]));
    if (myPhotos.length >= 3) out.push(make("shutterbug", userId, "3/3 shots", undefined, myPhotoTimes[2]));
    if (warmCount > 0 && coolCount > 0) {
      const firstWarm = Math.min(...warmPhotos.map((p) => new Date(p.taken_at).getTime()));
      const firstCool = Math.min(...coolPhotos.map((p) => new Date(p.taken_at).getTime()));
      out.push(make("both-filters", userId, undefined, undefined, Math.max(firstWarm, firstCool)));
    }
  }
  if (wantEnd) {
    if (myPhotos.length > 0 && coolCount === myPhotos.length) {
      out.push(make("cool-eye", userId, `${coolCount} cool`, undefined, lastPhotoMs));
    }
    if (myPhotos.length > 0 && warmCount === myPhotos.length) {
      out.push(make("warm-eye", userId, `${warmCount} warm`, undefined, lastPhotoMs));
    }
    const flags = activityFlags(ctx, userId);
    if (myPhotos.length === 0 && (flags.drank || flags.voted || flags.played)) {
      out.push(make("no-pic-no-proof", userId, undefined, undefined, endOfPartyMs));
    }
  }

  // ── ITINERARY ──────────────────────────────────────────────────────────
  const myReactions = ctx.itineraryReactions.filter((r) => r.user_id === userId);
  const myReactionTimes = myReactions.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
  const lastReactionMs = myReactionTimes.length ? myReactionTimes[myReactionTimes.length - 1] : undefined;
  if (wantLive) {
    // Time when the user first reached the 3-distinct-event threshold.
    const seenEvents = new Set<string>();
    let hypeAtMs: number | undefined;
    for (const r of myReactions.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
      if (!seenEvents.has(r.event_id)) {
        seenEvents.add(r.event_id);
        if (seenEvents.size === 3) {
          hypeAtMs = new Date(r.created_at).getTime();
          break;
        }
      }
    }
    if (hypeAtMs !== undefined) {
      out.push(make("hype-buck", userId, `${seenEvents.size} events`, undefined, hypeAtMs));
    }
    // Per-trigger: one Doom Buck per 💀 reaction.
    for (const r of myReactions) {
      if (r.reaction !== "💀") continue;
      out.push(make("doom-buck", userId, undefined, `${r.event_id}:${r.user_id}`, new Date(r.created_at).getTime()));
    }
    // Time when 6th distinct emoji was first used.
    const seenEmoji = new Set<string>();
    let czarAtMs: number | undefined;
    for (const r of myReactions.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
      if (!seenEmoji.has(r.reaction)) {
        seenEmoji.add(r.reaction);
        if (seenEmoji.size === 6) {
          czarAtMs = new Date(r.created_at).getTime();
          break;
        }
      }
    }
    if (czarAtMs !== undefined) {
      out.push(make("reaction-czar", userId, `${seenEmoji.size} emoji`, undefined, czarAtMs));
    }
    for (const evt of ctx.itineraryEvents) {
      const evtReactions = ctx.itineraryReactions.filter(
        (r) => r.event_id === evt.id,
      );
      if (evtReactions.length < 2) continue;
      const sorted = [...evtReactions].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      if (sorted[0].user_id === userId) {
        out.push(make("trendsetter", userId, "first react", evt.id, new Date(sorted[0].created_at).getTime()));
      }
    }
    // Per-trigger: one Punctual per <10min reaction (one event = one badge).
    const TEN_MIN = 10 * 60 * 1000;
    for (const r of myReactions) {
      const evt = ctx.itineraryEvents.find((e) => e.id === r.event_id);
      if (!evt) continue;
      const delta =
        new Date(r.created_at).getTime() - new Date(evt.created_at).getTime();
      if (delta >= 0 && delta <= TEN_MIN) {
        out.push(make("punctual", userId, "<10 min", r.event_id, new Date(r.created_at).getTime()));
      }
    }
  }
  if (wantEnd) {
    if (ctx.itineraryEvents.length >= 2) {
      const reactedEventIds = new Set(myReactions.map((r) => r.event_id));
      const reactedAll = ctx.itineraryEvents.every((evt) =>
        reactedEventIds.has(evt.id),
      );
      if (reactedAll) {
        out.push(make("hyped-up", userId, `${ctx.itineraryEvents.length}/${ctx.itineraryEvents.length}`, undefined, lastReactionMs ?? endOfPartyMs));
      }
    }
  }

  // ── APP OPENS ──────────────────────────────────────────────────────────
  const myOpens = ctx.appOpens.filter((o) => o.user_id === userId);
  const myOpenTimes = myOpens.map((o) => new Date(o.opened_at).getTime()).sort((a, b) => a - b);
  if (wantLive) {
    if (ctx.appOpens.length > 0) {
      const earliest = [...ctx.appOpens].sort(
        (a, b) =>
          new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime(),
      )[0];
      if (earliest.user_id === userId) {
        out.push(make("early-bird", userId, "first open", undefined, new Date(earliest.opened_at).getTime()));
      }
    }
    if (myOpens.length >= 10) {
      out.push(make("refresher", userId, `${myOpens.length} opens`, undefined, myOpenTimes[9]));
    }
    if (myOpens.length >= 100) {
      out.push(make("locked-in", userId, `${myOpens.length} opens`, undefined, myOpenTimes[99]));
    }
  }
  if (wantEnd) {
    const otherOpens = ctx.appOpens.filter((o) => o.user_id !== userId);
    if (myOpens.length > 0 && otherOpens.length > 0) {
      const latest = [...ctx.appOpens].sort(
        (a, b) =>
          new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
      )[0];
      if (latest.user_id === userId) {
        out.push(make("last-light", userId, "last open", undefined, new Date(latest.opened_at).getTime()));
      }
    }
  }

  // ── CROSS-FEATURE ──────────────────────────────────────────────────────
  const flags = activityFlags(ctx, userId);
  if (wantLive) {
    if (flags.drank && flags.voted && flags.played && flags.photographed) {
      out.push(make("renaissance-buck", userId, undefined, undefined, userLatestMs ?? undefined));
    }
    const user = ctx.users.find((u) => u.id === userId);
    if (user && userDrinks.length > 0) {
      const ss = Math.min(...userTimes);
      const p = peakBAC(user, userDrinks, ss);
      const leadingAGame = [...myGameIds].some((gameId) => {
        const totals = ctx.gameTotals.filter((t) => t.game_id === gameId);
        if (totals.length < 2) return false;
        const top = [...totals].sort(
          (a, b) => Number(b.total_score) - Number(a.total_score),
        )[0];
        return top.user_id === userId && Number(top.total_score) > 0;
      });
      if (p.status === "ok" && p.value > 0.1 && leadingAGame) {
        out.push(make("hot-streak", userId, p.value.toFixed(3), undefined, lastGameActivityForMe ?? lastDrinkMs ?? undefined));
      }
    }
  }
  if (wantEnd) {
    // Triple Crown — uses other end-of-day badges
    const myIds = new Set(out.map((b) => b.id));
    if (
      myIds.has("heavyweight") &&
      myIds.has("game-champion") &&
      myIds.has("rule-maker")
    ) {
      out.push(make("triple-crown", userId, undefined, undefined, endOfPartyMs));
    }
    // Iron Man — composite of three gold-tier badges (mirrors Triple Crown)
    if (
      myIds.has("centurion") &&
      myIds.has("iron-liver") &&
      myIds.has("dynasty")
    ) {
      out.push(make("iron-man", userId, undefined, undefined, endOfPartyMs));
    }
    // Ice Cold — won at least 1 finished game but no/zero BAC
    const user = ctx.users.find((u) => u.id === userId);
    const finishedGameIds = new Set(
      ctx.games.filter((g) => g.finished).map((g) => g.id),
    );
    const finishedTotals = ctx.gameTotals.filter((t) =>
      finishedGameIds.has(t.game_id),
    );
    const wins = gameWinsByUser(finishedTotals).find((r) => r.user_id === userId);
    if (user && wins && wins.wins > 0) {
      if (userDrinks.length === 0) {
        out.push(make("ice-cold", userId, "0 drinks", undefined, endOfPartyMs));
      } else {
        const ss = Math.min(...userTimes);
        const p = peakBAC(user, userDrinks, ss);
        if (p.status === "ok" && p.value === 0) {
          out.push(make("ice-cold", userId, "BAC 0.000", undefined, endOfPartyMs));
        }
      }
    }
    // No Show — user existed in window but did nothing
    const u = ctx.users.find((x) => x.id === userId);
    if (u) {
      const created = new Date(u.created_at).getTime();
      const presentForWindow =
        created < ctx.windowEndMs && created >= ctx.windowStartMs;
      if (
        presentForWindow &&
        !flags.drank &&
        !flags.voted &&
        !flags.played &&
        !flags.photographed &&
        !flags.spun &&
        !flags.pooled
      ) {
        out.push(make("no-show", userId, undefined, undefined, ctx.windowEndMs));
      }
    }
  }

  // Stamp every badge with the user's most recent activity time as a default
  // "earned at". Cheap and good enough for end-of-day badges; live badges that
  // want a precise trigger time can set earnedAtMs themselves on `make()`.
  if (userLatestMs !== null) {
    for (const b of out) {
      if (b.earnedAtMs === undefined) b.earnedAtMs = userLatestMs;
    }
  }

  return out;
}

function lastUserActivityMs(ctx: AchievementCtx, userId: string): number | null {
  let max = -Infinity;
  const consider = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  };
  for (const d of ctx.drinks) if (d.user_id === userId) consider(d.logged_at);
  for (const r of ctx.voteResponses) if (r.user_id === userId) consider(r.updated_at);
  for (const i of ctx.voteItems) if (i.proposer_id === userId) consider(i.created_at);
  for (const s of ctx.gameScores) if (s.user_id === userId) consider(s.recorded_at);
  for (const sp of ctx.spins) {
    if (sp.spinner_id === userId || sp.winner_id === userId) consider(sp.created_at);
  }
  for (const p of ctx.photos) if (p.user_id === userId) consider(p.taken_at);
  for (const r of ctx.itineraryReactions) if (r.user_id === userId) consider(r.created_at);
  for (const e of ctx.itineraryEvents) if (e.created_by === userId) consider(e.created_at);
  for (const o of ctx.appOpens) if (o.user_id === userId) consider(o.opened_at);
  return max === -Infinity ? null : max;
}

type ActivityFlags = {
  drank: boolean;
  voted: boolean;
  played: boolean;
  photographed: boolean;
  spun: boolean;
  pooled: boolean;
  nonDrink: boolean;
};

function activityFlags(ctx: AchievementCtx, userId: string): ActivityFlags {
  const drank = ctx.drinks.some((d) => d.user_id === userId);
  const voted =
    ctx.voteResponses.some((r) => r.user_id === userId) ||
    ctx.voteItems.some((i) => i.proposer_id === userId);
  const played = ctx.gamePlayers.some((p) => p.user_id === userId);
  const photographed = ctx.photos.some((p) => p.user_id === userId);
  const spun = ctx.spins.some((s) => s.spinner_id === userId);
  const pooled = ctx.spins.some(
    (s) => s.pool.includes(userId) || s.winner_id === userId,
  );
  return {
    drank,
    voted,
    played,
    photographed,
    spun,
    pooled,
    nonDrink: voted || played || photographed || spun || pooled,
  };
}
