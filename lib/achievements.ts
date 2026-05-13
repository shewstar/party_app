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
  // Drinks — end-of-day
  { id: "heavyweight", title: "Heavyweight", blurb: "Most standard drinks of the night.", icon: "🧱", tier: "win", timing: "endOfDay" },
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
  { id: "clutch", title: "Clutch", blurb: "Leading a game by exactly 1.", icon: "🎯", tier: "win", timing: "live" },
  { id: "triathlete", title: "Triathlete", blurb: "Joined 3+ games.", icon: "🎮", tier: "win", timing: "live" },
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
  { id: "strong-hand", title: "Strong Hand", blurb: "Avg ≥ 1.5 std drinks per drink (5+).", icon: "💪", tier: "win", timing: "live" },
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

function make(id: string, userId: string, detail?: string, suffix?: string): EarnedBadge {
  const a = byId.get(id);
  if (!a) throw new Error(`Unknown achievement: ${id}`);
  const key = suffix ? `${id}:${suffix}` : id;
  return { ...a, userId, key, detail };
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

  const userDrinks = ctx.drinks.filter((d) => d.user_id === userId);
  const drinkCount = userDrinks.length;
  const totalStd = userDrinks.reduce((s, d) => s + Number(d.standard_drinks), 0);
  const userTimes = userDrinks.map((d) => new Date(d.logged_at).getTime());
  const firstDrinkMs = userTimes.length ? Math.min(...userTimes) : null;
  const lastDrinkMs = userTimes.length ? Math.max(...userTimes) : null;

  // ── DRINKS (live) ──────────────────────────────────────────────────────
  if (wantLive) {
    if (firstDrinkMs !== null) {
      const earliest = Math.min(
        ...ctx.drinks.map((d) => new Date(d.logged_at).getTime()),
      );
      if (firstDrinkMs === earliest) {
        out.push(make("quick-off-the-mark", userId, "first drink of the night"));
      }
    }
    if (drinkCount >= 10) {
      out.push(make("marathon-runner", userId, `${drinkCount} drinks`));
    }
    if (drinkCount >= 20) {
      out.push(make("centurion", userId, `${drinkCount} drinks`));
    }
    if (drinkCount >= 30) {
      out.push(make("the-beast", userId, `${drinkCount} drinks`));
    }
    if (drinkCount >= 5 && totalStd / drinkCount >= 1.5) {
      out.push(make("strong-hand", userId, `${(totalStd / drinkCount).toFixed(2)} std avg`));
    }
    const pace = fastestPace(userDrinks);
    if (pace >= 5) {
      out.push(make("pacesetter", userId, `${pace} in 60 min`));
    }
    if (pace >= 8) {
      out.push(make("speed-demon", userId, `${pace} in 60 min`));
    }
    const cats = new Set(userDrinks.map((d) => d.category));
    if (cats.size === 3) {
      out.push(make("variety-pack", userId, "beer + wine + spirits"));
    }
    const hasAfter2 = userDrinks.some((d) => {
      const h = new Date(d.logged_at).getHours();
      return h >= 2 && h < 5;
    });
    if (hasAfter2) out.push(make("night-owl", userId, "after 2am"));

    if (firstDrinkMs !== null) {
      const h = new Date(firstDrinkMs).getHours();
      if (h >= 22 || h < 5) {
        out.push(make("late-starter", userId, "first drink late"));
      }
    }
    const myLabels = new Set(
      userDrinks.map((d) => d.label).filter((l): l is string => !!l),
    );
    if (myLabels.size > 0) {
      const matched = ctx.drinks.some(
        (d) => d.user_id !== userId && d.label && myLabels.has(d.label),
      );
      if (matched) out.push(make("cheers-club", userId));
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
      out.push(make("heavyweight", userId, `${topStd[1].toFixed(1)} std`));
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
        out.push(make("peak-performer", userId, me.value.toFixed(3)));
      }
      if (me.status === "ok" && me.value > 0.2) {
        out.push(make("iron-liver", userId, me.value.toFixed(3)));
      }
    }

    if (drinkCount === 1 || drinkCount === 2) {
      out.push(make("pacing-yourself", userId, `${drinkCount} drink${drinkCount === 1 ? "" : "s"}`));
    }
    // Designated Survivor + No Show distinguish: Survivor = did SOMETHING but no drinks.
    // No Show handled in cross-feature.
    const didSomethingNonDrink = activityFlags(ctx, userId).nonDrink;
    if (drinkCount === 0 && didSomethingNonDrink) {
      out.push(make("designated-survivor", userId));
    }
    if (drinkCount === 1 && firstDrinkMs !== null) {
      const h = new Date(firstDrinkMs).getHours();
      const earlyHour = h >= 5 && h < 21;
      if (earlyHour) out.push(make("one-and-done", userId, "before 9pm"));
    }
  }

  // ── VOTES ──────────────────────────────────────────────────────────────
  const myProposals = ctx.voteItems.filter((i) => i.proposer_id === userId);
  const myTally = ctx.voteTally.filter((t) =>
    myProposals.some((p) => p.id === t.id),
  );
  const myResponses = ctx.voteResponses.filter((r) => r.user_id === userId);
  if (wantLive) {
    if (myProposals.length >= 3) {
      out.push(make("activist", userId, `${myProposals.length} proposals`));
    }
    for (const t of myTally) {
      if (t.net >= 3 && t.against_count === 0) {
        out.push(make("landslide", userId, `+${t.net}`, t.id));
        break;
      }
    }
  }
  if (wantEnd) {
    if (myTally.some((t) => t.net > 0)) {
      const best = myTally.reduce((a, b) => (a.net >= b.net ? a : b));
      out.push(make("rule-maker", userId, `+${best.net}`));
    }
    if (myProposals.length >= 10) {
      out.push(make("visionary", userId, `${myProposals.length} proposals`));
    }
    if (myTally.some((t) => t.net < 0)) {
      const worst = myTally.reduce((a, b) => (a.net <= b.net ? a : b));
      out.push(make("sad-trombone", userId, `${worst.net}`));
    }
    if (ctx.voteItems.length > 0) {
      if (myResponses.length === ctx.voteItems.length && myResponses.length > 0) {
        out.push(make("democracy", userId, `voted ${myResponses.length}/${ctx.voteItems.length}`));
      }
      if (myResponses.length === 0) {
        out.push(make("wallflower", userId));
      }
    }
    const forCount = myResponses.filter((r) => r.value === 1).length;
    const againstCount = myResponses.filter((r) => r.value === -1).length;
    if (againstCount > forCount && againstCount >= 2) {
      out.push(make("naysayer", userId, `${againstCount} against`));
    }
  }

  // ── GAMES ──────────────────────────────────────────────────────────────
  const myGames = ctx.gamePlayers.filter((gp) => gp.user_id === userId);
  const myGameIds = new Set(myGames.map((g) => g.game_id));
  const myGameTotals = ctx.gameTotals.filter((t) => t.user_id === userId);
  if (wantLive) {
    if (myGames.length >= 3) {
      out.push(make("triathlete", userId, `${myGames.length} games`));
    }
    // Clutch — leading by exactly 1 in any game
    for (const gameId of myGameIds) {
      const totals = ctx.gameTotals.filter((t) => t.game_id === gameId);
      if (totals.length < 2) continue;
      const sorted = [...totals].sort(
        (a, b) => Number(b.total_score) - Number(a.total_score),
      );
      if (
        sorted[0].user_id === userId &&
        Number(sorted[0].total_score) - Number(sorted[1].total_score) === 1
      ) {
        out.push(make("clutch", userId, "leading by 1", gameId));
      }
    }
    if (myGameTotals.some((t) => Number(t.total_score) < 0)) {
      out.push(make("net-negative", userId));
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

    const wins = gameWinsByUser(finishedTotals);
    const myWins = wins.find((r) => r.user_id === userId);
    const topWins = [...wins].sort((a, b) => b.wins - a.wins || b.total - a.total)[0];
    if (topWins && topWins.user_id === userId && topWins.wins > 0) {
      out.push(make("game-champion", userId, `${topWins.wins} W`));
    }
    if (myWins && myWins.wins >= 5) {
      out.push(make("dynasty", userId, `${myWins.wins} W`));
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
      if (wonAll) out.push(make("sweeper", userId, `${myFinishedGameIds.size} games`));
    }
    for (const gameId of myFinishedGameIds) {
      const totals = finishedTotals.filter((t) => t.game_id === gameId);
      if (totals.length < 3) continue;
      const sorted = [...totals].sort(
        (a, b) => Number(a.total_score) - Number(b.total_score),
      );
      if (sorted[0].user_id === userId && Number(sorted[0].total_score) <= 0) {
        out.push(make("wooden-spoon", userId, "last place", gameId));
        break;
      }
    }
    for (const t of myGameTotals) {
      if (!finishedGameIds.has(t.game_id)) continue;
      if (Number(t.total_score) === 0) {
        const totals = finishedTotals.filter((x) => x.game_id === t.game_id);
        if (totals.length >= 2) {
          out.push(make("bagel", userId, "0 pts", t.game_id));
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
  const spunByMe = ctx.spins.filter((s) => s.spinner_id === userId);
  const pooledSpins = ctx.spins.filter((s) => s.pool.includes(userId));
  if (wantLive) {
    if (wonSpins.length >= 1) {
      out.push(make("chosen-one", userId));
    }
    if (wonSpins.length >= 3) {
      out.push(make("magnet", userId, `${wonSpins.length}× picked`));
    }
    if (wonSpins.length >= 5) {
      out.push(make("four-leaf", userId, `${wonSpins.length}× picked`));
    }
    if (spunByMe.length >= 5) {
      out.push(make("spinmeister", userId, `${spunByMe.length} spins`));
    }
  }
  if (wantEnd) {
    if (pooledSpins.length >= 5 && wonSpins.length === 0) {
      out.push(make("ghosted", userId, `${pooledSpins.length} pools, 0 picks`));
    }
  }

  // ── CAMERA ─────────────────────────────────────────────────────────────
  const myPhotos = ctx.photos.filter((p) => p.user_id === userId);
  const warmCount = myPhotos.filter((p) => p.filter_variant === "warm").length;
  const coolCount = myPhotos.filter((p) => p.filter_variant === "cool").length;
  if (wantLive) {
    if (myPhotos.length >= 1) out.push(make("film-loaded", userId));
    if (myPhotos.length >= 3) out.push(make("shutterbug", userId, "3/3 shots"));
    if (warmCount > 0 && coolCount > 0) {
      out.push(make("both-filters", userId));
    }
  }
  if (wantEnd) {
    if (myPhotos.length > 0 && coolCount === myPhotos.length) {
      out.push(make("cool-eye", userId, `${coolCount} cool`));
    }
    if (myPhotos.length > 0 && warmCount === myPhotos.length) {
      out.push(make("warm-eye", userId, `${warmCount} warm`));
    }
    const flags = activityFlags(ctx, userId);
    if (myPhotos.length === 0 && (flags.drank || flags.voted || flags.played)) {
      out.push(make("no-pic-no-proof", userId));
    }
  }

  // ── ITINERARY ──────────────────────────────────────────────────────────
  const myReactions = ctx.itineraryReactions.filter((r) => r.user_id === userId);
  if (wantLive) {
    const reactedEventIds = new Set(myReactions.map((r) => r.event_id));
    if (reactedEventIds.size >= 3) {
      out.push(make("hype-buck", userId, `${reactedEventIds.size} events`));
    }
    if (myReactions.some((r) => r.reaction === "💀")) {
      out.push(make("doom-buck", userId));
    }
    const distinctEmoji = new Set(myReactions.map((r) => r.reaction));
    if (distinctEmoji.size >= 6) {
      out.push(make("reaction-czar", userId, `${distinctEmoji.size} emoji`));
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
        out.push(make("trendsetter", userId, "first react", evt.id));
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
        out.push(make("hyped-up", userId, `${ctx.itineraryEvents.length}/${ctx.itineraryEvents.length}`));
      }
    }
  }

  // ── APP OPENS ──────────────────────────────────────────────────────────
  const myOpens = ctx.appOpens.filter((o) => o.user_id === userId);
  if (wantLive) {
    if (ctx.appOpens.length > 0) {
      const earliest = [...ctx.appOpens].sort(
        (a, b) =>
          new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime(),
      )[0];
      if (earliest.user_id === userId) {
        out.push(make("early-bird", userId, "first open"));
      }
    }
    if (myOpens.length >= 10) {
      out.push(make("refresher", userId, `${myOpens.length} opens`));
    }
    if (myOpens.length >= 100) {
      out.push(make("locked-in", userId, `${myOpens.length} opens`));
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
        out.push(make("last-light", userId, "last open"));
      }
    }
  }

  // ── CROSS-FEATURE ──────────────────────────────────────────────────────
  const flags = activityFlags(ctx, userId);
  if (wantLive) {
    if (flags.drank && flags.voted && flags.played && flags.photographed) {
      out.push(make("renaissance-buck", userId));
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
        out.push(make("hot-streak", userId, p.value.toFixed(3)));
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
      out.push(make("triple-crown", userId));
    }
    // Iron Man — composite of three gold-tier badges (mirrors Triple Crown)
    if (
      myIds.has("centurion") &&
      myIds.has("iron-liver") &&
      myIds.has("dynasty")
    ) {
      out.push(make("iron-man", userId));
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
        out.push(make("ice-cold", userId, "0 drinks"));
      } else {
        const ss = Math.min(...userTimes);
        const p = peakBAC(user, userDrinks, ss);
        if (p.status === "ok" && p.value === 0) {
          out.push(make("ice-cold", userId, "BAC 0.000"));
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
        out.push(make("no-show", userId));
      }
    }
  }

  return out;
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
