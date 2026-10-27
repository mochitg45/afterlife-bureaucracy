/**
 * Afterlife Reviews: processed souls rate the office. A smoothed 1-5 reputation follows how
 * actively the office is run and pays a small, floored income bonus. Pure logic only; the
 * store owns the timers. The bonus reaches only the live office tick (src/engine/economy.ts
 * `reputation` argument), never event currency, vouchers, seals or offline pay.
 */
export type ReviewDept = 'intake' | 'heaven' | 'hell' | 'limbo' | 'reincarnation' | 'valhalla' | 'any';

export interface ReviewTemplate {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  who: string;
  handle: string;
  dept: ReviewDept;
  text: string;
}

/** What is saved of a review: text is looked up by template id so it follows the language. */
export interface SavedReview {
  n: number;
  id: string;
  wall: number;
  complaint?: true;
  /** Index of the canned reply shown once responded. */
  reply?: number;
}

export interface Reputation { score: number; reviews: SavedReview[] }

export const REVIEW_MIN_MS = 60_000;
export const REVIEW_MAX_MS = 120_000;
export const FEED_SIZE = 20;
export const START_SCORE = 3.5;
/** Target floor: a pure idler is never pushed below this. */
export const IDLE_FLOOR = 3.0;
export const SMOOTHING = 0.2;
export const MAX_MULT = 1.1;
export const COMPLAINTS_PER_HOUR = 3;
export const COMPLAINT_ODDS = 0.4;
export const RESPOND_BONUS = 0.06;
export const REPLY_COUNT = 6;
export const IDLE_BACKLOG_MS = 30 * 60_000;

export const nextReviewDelay = (rng: () => number = Math.random): number =>
  REVIEW_MIN_MS + rng() * (REVIEW_MAX_MS - REVIEW_MIN_MS);

export const clampScore = (s: number): number => (Number.isFinite(s) ? Math.min(5, Math.max(1, s)) : START_SCORE);

/** What happened since the previous review. */
export interface RepSignals {
  stamps: number;
  dailiesClaimed: number;
  incidentsFixed: number;
  /** Incidents currently past their grace period. */
  incidentsIgnored: number;
  idleMs: number;
}

/** Where the score is heading: 3.5 plus active play, minus neglect, never under IDLE_FLOOR. */
export function reputationTarget(s: RepSignals): number {
  const up = Math.min(1.1, (s.stamps / 40) * 1.1) + Math.min(0.3, s.dailiesClaimed * 0.15) + Math.min(0.3, s.incidentsFixed * 0.15);
  const down = Math.min(0.2, s.incidentsIgnored * 0.1) + (s.incidentsIgnored > 0 && s.idleMs >= IDLE_BACKLOG_MS ? 0.15 : 0);
  return Math.min(5, Math.max(IDLE_FLOOR, START_SCORE + up - down));
}

/** One smoothing step toward the target. */
export const stepScore = (score: number, target: number): number => clampScore(score + (target - score) * SMOOTHING);

/** Office income multiplier: 3 stars or less = 1.00x, 5 stars = 1.10x, linear between, never a penalty. */
export function reputationMult(score: number): number {
  const f = Math.min(1, Math.max(0, (clampScore(score) - 3) / 2));
  return 1 + (MAX_MULT - 1) * f;
}

export const tierOf = (score: number): number => Math.min(5, Math.max(1, Math.floor(clampScore(score) + 1e-9)));

export function recentComplaints(reviews: readonly SavedReview[], nowWall: number): number {
  return reviews.filter((r) => r.complaint && nowWall - r.wall < 3600_000).length;
}

/**
 * Picks the next review: stars drawn around the current score, only from departments the
 * player has opened. A 1-2 star pick may become a complaint (a few per hour at most).
 */
export function pickReview(
  templates: readonly ReviewTemplate[],
  unlocked: readonly string[],
  score: number,
  history: readonly SavedReview[],
  nowWall: number,
  n: number,
  rng: () => number = Math.random,
): SavedReview | null {
  const ok = templates.filter((t) => t.dept === 'any' || unlocked.includes(t.dept));
  if (!ok.length) return null;
  const want = Math.min(5, Math.max(1, Math.round(score + (rng() + rng() - 1) * 2)));
  // Nearest star level that has a template, so a thin department set never stalls the feed.
  let pool: ReviewTemplate[] = [];
  for (let d = 0; d <= 4 && !pool.length; d++) pool = ok.filter((t) => Math.abs(t.stars - want) === d);
  const fresh = pool.filter((t) => !history.slice(0, 10).some((h) => h.id === t.id));
  const from = fresh.length ? fresh : pool;
  const t = from[Math.floor(rng() * from.length)];
  const complaint = t.stars <= 2 && recentComplaints(history, nowWall) < COMPLAINTS_PER_HOUR && rng() < COMPLAINT_ODDS;
  return { n, id: t.id, wall: nowWall, ...(complaint ? { complaint: true as const } : {}) };
}

export const addReview = (rep: Reputation, r: SavedReview): Reputation => ({ ...rep, reviews: [r, ...rep.reviews].slice(0, FEED_SIZE) });

/** Answers a complaint: nudges the score up a little. Unknown or already-answered: unchanged. */
export function respondTo(rep: Reputation, n: number, replyIndex: number): Reputation {
  const r = rep.reviews.find((x) => x.n === n);
  if (!r || !r.complaint || r.reply !== undefined) return rep;
  return {
    score: clampScore(rep.score + RESPOND_BONUS),
    reviews: rep.reviews.map((x) => (x.n === n ? { ...x, reply: ((replyIndex % REPLY_COUNT) + REPLY_COUNT) % REPLY_COUNT } : x)),
  };
}

export const initialReputation = (): Reputation => ({ score: START_SCORE, reviews: [] });

export function sanitizeReputation(v: unknown): Reputation {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const score = typeof r.score === 'number' ? clampScore(r.score) : START_SCORE;
  const seen = new Set<number>();
  const reviews: SavedReview[] = [];
  for (const x of Array.isArray(r.reviews) ? (r.reviews as unknown[]) : []) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n < 0 || seen.has(o.n)) continue;
    seen.add(o.n);
    const e: SavedReview = { n: o.n, id: o.id, wall: typeof o.wall === 'number' && Number.isFinite(o.wall) && o.wall > 0 ? o.wall : 0 };
    if (o.complaint === true) e.complaint = true;
    if (e.complaint && Number.isInteger(o.reply) && (o.reply as number) >= 0 && (o.reply as number) < REPLY_COUNT) e.reply = o.reply as number;
    reviews.push(e);
    if (reviews.length >= FEED_SIZE) break;
  }
  return { score, reviews };
}
