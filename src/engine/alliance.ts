/**
 * Office Alliance: up to ten players share a weekly stamp goal. The alliance and its running
 * total live in Firestore (platform/alliance.ts); this is the pure part -- the week number,
 * the tiers, and the once-per-week-per-tier claims kept in the save.
 */
import type { GameState } from './state';
import { grantVouchersExact } from './vouchers';

export const ALLIANCE_MAX = 10;
/** One member's stamps that count toward the alliance in one week; firestore.rules enforces the same. */
export const MEMBER_WEEK_CAP = 10_000;

const WEEK_MS = 7 * 24 * 3600_000;
/** 1970-01-05, the first Monday after the epoch (a Thursday), 00:00 UTC. */
const FIRST_MONDAY_MS = 4 * 24 * 3600_000;

/**
 * Weeks since 1970-01-05, rolling over Monday 00:00 UTC: the same boundaries as ISO weeks, as
 * one integer the security rules can recompute from `request.time`.
 */
export function allianceWeek(wall: number): number {
  return Math.floor((wall - FIRST_MONDAY_MS) / WEEK_MS);
}

/** Wall-clock ms when `week` ends (the next Monday 00:00 UTC). */
export function allianceWeekEnd(week: number): number {
  return FIRST_MONDAY_MS + (week + 1) * WEEK_MS;
}

/**
 * Sized so ten active players (about 360 stamps a day each) reach tier 3 and a half-active
 * team lands on tier 1 or 2.
 */
export const ALLIANCE_TIERS: ReadonlyArray<{ stamps: number; vouchers: number; seals: number }> = [
  { stamps: 3_000, vouchers: 20, seals: 0 },
  { stamps: 10_000, vouchers: 40, seals: 10 },
  { stamps: 25_000, vouchers: 60, seals: 20 },
];

/** Claims for `week`; an older week's list counts as empty. */
export function claimedThisWeek(state: Pick<GameState, 'alliance'>, week: number): number[] {
  return state.alliance.week === week ? state.alliance.claimed : [];
}

/** Tier indexes reached by `stamps` this week and not yet taken. */
export function claimableAllianceTiers(state: GameState, week: number, stamps: number): number[] {
  const taken = claimedThisWeek(state, week);
  return ALLIANCE_TIERS.flatMap((t, i) => (stamps >= t.stamps && !taken.includes(i) ? [i] : []));
}

/**
 * Pays tier `index` for `week` once. `stamps` is the alliance total for that same week, as read
 * from the server. Returned by identity when it is not reached or already taken.
 */
export function claimAllianceTier(state: GameState, index: number, week: number, stamps: number): GameState {
  const tier = ALLIANCE_TIERS[index];
  if (!tier || !claimableAllianceTiers(state, week, stamps).includes(index)) return state;
  const paid = grantVouchersExact(state, tier.vouchers);
  return { ...paid, seals: paid.seals + tier.seals, alliance: { week, claimed: [...claimedThisWeek(state, week), index] } };
}

export function sanitizeAlliance(v: unknown): GameState['alliance'] {
  const r = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as { week?: unknown; claimed?: unknown };
  const week = Number.isInteger(r.week) && (r.week as number) >= 0 ? (r.week as number) : 0;
  const claimed = Array.isArray(r.claimed)
    ? [...new Set((r.claimed as unknown[]).filter((i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < ALLIANCE_TIERS.length))]
    : [];
  return { week, claimed };
}

const ADJECTIVES = ['Eternal', 'Celestial', 'Spectral', 'Infernal', 'Hallowed', 'Misty', 'Ghostly', 'Cosmic', 'Drowsy', 'Wobbly', 'Velvet', 'Midnight'];
const NOUNS = ['Stampers', 'Clerks', 'Filers', 'Inkwells', 'Ledgers', 'Notaries', 'Auditors', 'Couriers', 'Scribes', 'Wardens'];

/** A fun alliance name, at most 24 characters (the rules' limit). */
export function allianceName(random: () => number = Math.random): string {
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length) % xs.length];
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** Invite codes: 6 letters from the unambiguous alphabet (no 0/O, 1/I, L). */
export const ALLIANCE_CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export function normalizeAllianceCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return ALLIANCE_CODE_RE.test(code) ? code : null;
}
