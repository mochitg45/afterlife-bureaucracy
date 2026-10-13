import type { GameState } from './state';
import type { Content } from './content';
import type { PullResult } from './gacha';
import { grantVouchersExact } from './vouchers';
import { bankEventCard } from './events';
import { dayKey, daysBetween } from './dailies';

/* ---------- Beginner Week: one goal a day for a new player's first seven days ---------- */

export type BeginnerReward = { type: 'vouchers' | 'seals'; amount: number } | { type: 'card'; card: string };
export type BeginnerGoal = 'hires' | 'depts' | 'upgrades' | 'pulls' | 'equips' | 'dailies' | 'clicks';

export interface BeginnerDay {
  day: number;
  goal: BeginnerGoal;
  target: number;
  reward: BeginnerReward;
}

/** Day 2 and day 7 pay a guaranteed card: the reasons to come back tomorrow and next week. */
export const BEGINNER_DAYS: readonly BeginnerDay[] = [
  { day: 1, goal: 'hires', target: 25, reward: { type: 'vouchers', amount: 20 } },
  { day: 2, goal: 'depts', target: 2, reward: { type: 'card', card: 'c-dave-cooked' } },
  { day: 3, goal: 'upgrades', target: 15, reward: { type: 'vouchers', amount: 30 } },
  { day: 4, goal: 'pulls', target: 5, reward: { type: 'seals', amount: 10 } },
  { day: 5, goal: 'equips', target: 1, reward: { type: 'vouchers', amount: 40 } },
  { day: 6, goal: 'dailies', target: 6, reward: { type: 'seals', amount: 20 } },
  { day: 7, goal: 'clicks', target: 1000, reward: { type: 'card', card: 'c-seraph-board' } },
];

/** Days after the last one still claimable, for a player who fell a little behind. */
export const BEGINNER_GRACE_DAYS = 7;

/** Day 1 is the install day; it follows the dailies' local day, like the check-in. */
export function beginnerDay(state: Pick<GameState, 'firstSeenWallClock' | 'dailies'>): number {
  if (!state.dailies.date) return 1;
  return daysBetween(dayKey(state.firstSeenWallClock), state.dailies.date) + 1;
}

export function beginnerActive(state: Pick<GameState, 'firstSeenWallClock' | 'dailies' | 'beginner'>): boolean {
  return state.beginner.claimed.length < BEGINNER_DAYS.length && beginnerDay(state) <= BEGINNER_DAYS.length + BEGINNER_GRACE_DAYS;
}

export function beginnerProgress(state: Pick<GameState, 'stats' | 'deptsUnlocked'>, goal: BeginnerGoal): number {
  switch (goal) {
    case 'hires': return state.stats.staffHired;
    case 'depts': return state.deptsUnlocked.length;
    case 'upgrades': return state.stats.upgradesBought;
    case 'pulls': return state.stats.pulls;
    case 'equips': return state.stats.equips;
    case 'dailies': return state.stats.dailiesClaimed;
    case 'clicks': return state.stats.clicks;
  }
}

/** The slices Beginner Week reads, so the Tasks screen can subscribe to just these. */
export type BeginnerView = Pick<GameState, 'firstSeenWallClock' | 'dailies' | 'beginner' | 'stats' | 'deptsUnlocked'>;

export function beginnerClaimable(state: BeginnerView, def: BeginnerDay): boolean {
  return beginnerActive(state)
    && beginnerDay(state) >= def.day
    && !state.beginner.claimed.includes(def.day)
    && beginnerProgress(state, def.goal) >= def.target;
}

export function claimBeginner(state: GameState, content: Content, day: number): { state: GameState; reward: BeginnerReward | null; card: PullResult | null } {
  const def = BEGINNER_DAYS.find((d) => d.day === day);
  if (!def || !beginnerClaimable(state, def)) return { state, reward: null, card: null };
  const marked = { ...state, beginner: { claimed: [...state.beginner.claimed, day] } };
  const r = def.reward;
  if (r.type === 'card') {
    const banked = bankEventCard(marked, content, r.card);
    return { state: banked.state, reward: r, card: banked.result };
  }
  const paid = r.type === 'vouchers' ? grantVouchersExact(marked, r.amount) : { ...marked, seals: marked.seals + r.amount };
  return { state: paid, reward: r, card: null };
}

/* ---------- Welcome back: a gift for a player returning after days away ---------- */

export const COMEBACK_AFTER_SEC = 3 * 86_400;
export const COMEBACK_VOUCHERS = 30;
export const COMEBACK_BOOST_MS = 3_600_000;

/**
 * Pays the welcome-back gift for a gap of `elapsedSec`: vouchers plus an hour of the 2x boost
 * (extending a boost already running). Only players who had started playing qualify.
 */
export function welcomeBack(state: GameState, elapsedSec: number, nowWall: number): { state: GameState; days: number } | null {
  if (elapsedSec < COMEBACK_AFTER_SEC || state.stats.staffHired < 1) return null;
  const paid = grantVouchersExact(state, COMEBACK_VOUCHERS);
  return {
    state: { ...paid, boostUntilWall: Math.max(nowWall, paid.boostUntilWall) + COMEBACK_BOOST_MS },
    days: Math.floor(elapsedSec / 86_400),
  };
}
