import Decimal from 'break_infinity.js';

/** Stamp Rush: a short opt-in burst of active play. Pure rules; the store applies the payout. */
export interface RushState {
  /** Rounds started since the last cooldown. */
  rounds: number;
  /** Wall-clock ms the next round unlocks at; 0 when free. */
  cooldownUntil: number;
}

export const RUSH_ROUNDS = 3;
export const RUSH_COOLDOWN_MS = 20 * 60 * 1000;
export const RUSH_SECONDS = 40;
/** The payout never exceeds this many seconds of the player's current rate (idle offline gives far more). */
export const RUSH_CAP_SEC = 150;
/** Seconds of rate paid per point scored. */
export const RUSH_SEC_PER_POINT = 0.5;
/** A client can claim at most this many points: ~45 s of perfect play at the fastest pace. */
export const RUSH_MAX_POINTS = 400;
export const RUSH_MAX_MULT = 3;
export const RUSH_FULL_COMBO = 30;

export const initialRush = (): RushState => ({ rounds: 0, cooldownUntil: 0 });

export function sanitizeRush(v: unknown): RushState {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rounds = typeof r.rounds === 'number' && Number.isFinite(r.rounds) ? Math.min(RUSH_ROUNDS, Math.max(0, Math.floor(r.rounds))) : 0;
  const cd = typeof r.cooldownUntil === 'number' && Number.isFinite(r.cooldownUntil) ? Math.max(0, r.cooldownUntil) : 0;
  return { rounds, cooldownUntil: cd };
}

/** True when a round may start: not cooling down. A cooldown set in the far future (clock tampering) is clamped. */
export function rushAvailable(r: RushState, nowWall: number): boolean {
  return nowWall >= Math.min(r.cooldownUntil, nowWall + RUSH_COOLDOWN_MS);
}

/** Counts a started round; the third one starts the cooldown. */
export function startRound(r: RushState, nowWall: number): RushState {
  const rounds = r.rounds + 1;
  return rounds >= RUSH_ROUNDS ? { rounds: 0, cooldownUntil: nowWall + RUSH_COOLDOWN_MS } : { rounds, cooldownUntil: 0 };
}

/** Payout multiplier: 1x at no combo, rising linearly to 3x at a 30 combo. */
export const comboMult = (combo: number) => 1 + (RUSH_MAX_MULT - 1) * Math.min(1, Math.max(0, combo) / RUSH_FULL_COMBO);

/** Souls and KC for a round: `points` scored, paid at the current rate, capped. */
export function rushPayout(points: number, rate: Decimal, kcRate: Decimal): { souls: Decimal; kc: Decimal } {
  const p = Number.isFinite(points) ? Math.min(RUSH_MAX_POINTS, Math.max(0, points)) : 0;
  const sec = Math.min(RUSH_CAP_SEC, p * RUSH_SEC_PER_POINT);
  return { souls: rate.mul(sec), kc: kcRate.mul(sec) };
}
