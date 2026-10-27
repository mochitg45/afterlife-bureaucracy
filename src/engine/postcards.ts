import Decimal from 'break_infinity.js';
import cards from '../data/postcards.json';
import { nextFloat } from './rng';
import type { GameState } from './state';

/**
 * Postcards from Reborn Souls. Souls processed by the Reincarnation Desk write home every few
 * real hours (a wall-clock timer, like the Overtime Boost), up to a small mailbox cap. Opening
 * one adds it to the Album and pays a small, capped soul bonus; album milestones pay vouchers.
 * Pure functions only: the store owns the clock, the souls and the vouchers.
 */
export interface PostcardsState {
  /** Album: ids of every postcard opened at least once. */
  collected: string[];
  /** Mailbox: ids delivered but not yet opened, oldest first. */
  waiting: string[];
  /** Wall-clock ms-epoch the next postcard is due; 0 until Reincarnation is first unlocked. */
  nextAtWall: number;
}

export type PostcardRarity = 'common' | 'uncommon' | 'rare';

const HOUR = 3_600_000;
export const POSTCARD_MIN_MS = 4 * HOUR;
export const POSTCARD_MAX_MS = 6 * HOUR;
export const MAILBOX_CAP = 3;
/** Opening pays this many seconds of current souls/sec, never more than SOUL_CAP_FRAC of lifetime souls. */
export const POSTCARD_REWARD_SEC = 120;
export const SOUL_CAP_FRAC = 0.01;
/** Album sizes that pay a flat voucher bonus once, the first time the album reaches them. */
export const ALBUM_MILESTONES: readonly { at: number; vouchers: number }[] = [
  { at: 10, vouchers: 2 },
  { at: 20, vouchers: 3 },
  { at: 40, vouchers: 5 },
];
export const POSTCARD_DEPT = 'reincarnation';

const WEIGHT: Record<PostcardRarity, number> = { common: 6, uncommon: 3, rare: 1 };
const RARITIES = new Set<string>(['common', 'uncommon', 'rare']);

export const POSTCARD_IDS: readonly string[] = cards.map((c) => c.id);
export const POSTCARD_RARITY: Record<string, PostcardRarity> = Object.fromEntries(
  cards.map((c) => [c.id, (RARITIES.has(c.rarity) ? c.rarity : 'common') as PostcardRarity]),
);

export const initialPostcards = (): PostcardsState => ({ collected: [], waiting: [], nextAtWall: 0 });

const known = new Set(POSTCARD_IDS);

export function sanitizePostcards(v: unknown): PostcardsState {
  const r = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const ids = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((i): i is string => typeof i === 'string' && known.has(i)))] : []);
  const collected = ids(r.collected);
  // Repeats are allowed in the mailbox once the album is complete, so only the cap is enforced here.
  const waiting = (Array.isArray(r.waiting) ? r.waiting.filter((i): i is string => typeof i === 'string' && known.has(i)) : []).slice(0, MAILBOX_CAP);
  const at = typeof r.nextAtWall === 'number' && Number.isFinite(r.nextAtWall) ? Math.max(0, r.nextAtWall) : 0;
  return { collected, waiting, nextAtWall: at };
}

const salt = (wall: number, p: PostcardsState) =>
  ((Math.floor(wall / 1000) ^ (p.collected.length * 7919) ^ (p.waiting.length * 104729)) >>> 0) || 1;

/** The next delivery delay: 4 to 6 hours, jittered deterministically. */
export function nextDelayMs(wall: number, p: PostcardsState): number {
  return POSTCARD_MIN_MS + Math.floor(nextFloat(salt(wall, p)).value * (POSTCARD_MAX_MS - POSTCARD_MIN_MS));
}

/**
 * Deterministic pick, weighted by rarity. A card never arrives twice until the album is
 * complete; after that repeats are allowed (just not one already sitting in the mailbox).
 */
export function pickPostcard(p: PostcardsState, seed: number): string {
  let pool = POSTCARD_IDS.filter((id) => !p.collected.includes(id) && !p.waiting.includes(id));
  if (pool.length === 0) pool = POSTCARD_IDS.filter((id) => !p.waiting.includes(id));
  if (pool.length === 0) pool = [...POSTCARD_IDS];
  const total = pool.reduce((a, id) => a + WEIGHT[POSTCARD_RARITY[id]], 0);
  let x = nextFloat(seed >>> 0 || 1).value * total;
  for (const id of pool) {
    x -= WEIGHT[POSTCARD_RARITY[id]];
    if (x < 0) return id;
  }
  return pool[pool.length - 1];
}

const deliver = (p: PostcardsState, wall: number): PostcardsState =>
  p.waiting.length >= MAILBOX_CAP ? p : { ...p, waiting: [...p.waiting, pickPostcard(p, salt(wall, p) + 1)] };

/**
 * The mail timer. Does nothing before Reincarnation opens or while the device clock cannot be
 * trusted (the same gate the daily rollover uses), so rewinding or jumping the clock never
 * mints cards. A long absence delivers at most one card, then restarts the timer from now: no
 * catch-up flood. A deadline further out than the longest delay (a rewound clock) is pulled in.
 */
export function tickPostcards(p: PostcardsState, wall: number, unlocked: boolean, trusted: boolean): PostcardsState {
  if (!unlocked || !trusted) return p;
  if (p.nextAtWall === 0) return { ...p, nextAtWall: wall + nextDelayMs(wall, p) };
  if (wall < p.nextAtWall) return p.nextAtWall - wall > POSTCARD_MAX_MS ? { ...p, nextAtWall: wall + POSTCARD_MAX_MS } : p;
  const next = deliver(p, wall);
  return { ...next, nextAtWall: wall + nextDelayMs(wall, next) };
}

/** One extra chance after each Audit: a card if there is room in the mailbox. Leaves the timer alone. */
export function postcardAfterAudit(p: PostcardsState, wall: number, unlocked: boolean): PostcardsState {
  return unlocked ? deliver(p, wall) : p;
}

export interface OpenResult {
  state: PostcardsState;
  id: string;
  isNew: boolean;
  /** Milestones the album crossed with this card, to pay once each. */
  milestones: { at: number; vouchers: number }[];
}

/** Opens the oldest waiting card, or null when the mailbox is empty. */
export function openPostcard(p: PostcardsState): OpenResult | null {
  if (p.waiting.length === 0) return null;
  const [id, ...rest] = p.waiting;
  const isNew = !p.collected.includes(id);
  const collected = isNew ? [...p.collected, id] : p.collected;
  const milestones = isNew ? ALBUM_MILESTONES.filter((m) => p.collected.length < m.at && collected.length >= m.at) : [];
  return { state: { ...p, collected, waiting: rest }, id, isNew, milestones };
}

/**
 * Whether the mailbox exists yet: once the Reincarnation Desk has opened, it stays (an Audit
 * re-locks departments but the souls already abroad keep writing).
 */
export function postcardsOpen(s: Pick<GameState, 'deptsUnlocked' | 'postcards'>): boolean {
  const p = s.postcards;
  return s.deptsUnlocked.includes(POSTCARD_DEPT) || p.nextAtWall > 0 || p.collected.length > 0 || p.waiting.length > 0;
}

/** State-level wrappers the store calls from its settle step and the audit action. */
export function mailPostcards(s: GameState, wall: number, trusted: boolean): GameState {
  const next = tickPostcards(s.postcards, wall, postcardsOpen(s), trusted);
  return next === s.postcards ? s : { ...s, postcards: next };
}
export function mailPostcardAfterAudit(s: GameState, wall: number): GameState {
  const next = postcardAfterAudit(s.postcards, wall, postcardsOpen(s));
  return next === s.postcards ? s : { ...s, postcards: next };
}

/** Two minutes of current souls/sec, capped at 1% of lifetime souls so it stays a garnish. */
export function postcardSouls(soulsPerSec: Decimal, soulsLifetime: Decimal): Decimal {
  const raw = soulsPerSec.mul(POSTCARD_REWARD_SEC);
  const cap = soulsLifetime.mul(SOUL_CAP_FRAC);
  return raw.lt(cap) ? raw : cap;
}
