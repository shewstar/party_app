// Vote-passing thresholds shared by the client UI and the
// vote-passed webhook so both sides agree on when a card locks.

// Minimum Yes votes needed regardless of how many people have joined.
// Prevents an early-night majority from locking a card before most of the
// group is in the app.
export const MIN_YES_VOTES = 6;

// Strict majority of the current user table. Mirrors the server rule
// `for_count > total / 2`, so the smallest integer that satisfies it is
// floor(total/2) + 1.
export function majorityThreshold(totalVoters: number): number {
  return Math.max(1, Math.floor(totalVoters / 2) + 1);
}

// What a vote actually has to clear to lock: a strict majority *and* the
// 6-vote floor. Use this everywhere — UI bar, captions, server route.
export function effectiveThreshold(totalVoters: number): number {
  return Math.max(MIN_YES_VOTES, majorityThreshold(totalVoters));
}
