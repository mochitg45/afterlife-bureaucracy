import Decimal from 'break_infinity.js';

/**
 * Office Incidents: small problems that pop up in the office scene while the app is open.
 * Fixing one pays a few minutes of current income (souls and KC only); leaving one alone
 * slowly costs office income. All of it lives in store memory, nothing is saved, and the
 * penalty reaches only the live office tick (never offline pay, never event income).
 */
export const INCIDENT_KINDS = ['printer', 'copier', 'coffee', 'queue', 'lights'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export interface Incident {
  id: number;
  kind: IncidentKind;
  /** Position in the scene, percent of its width / height. */
  x: number;
  y: number;
  spawnedMono: number;
  taps: number;
  need: number;
  /** analytics: incident_ignored already sent for this one. */
  ignoredSent?: boolean;
}

export const SPAWN_MIN_MS = 120_000;
export const SPAWN_MAX_MS = 240_000;
export const MAX_ACTIVE = 2;
export const TRAINING_DONE = 3;
/** A fix pays this many seconds of current souls/sec. */
export const REWARD_SECONDS = 180;
/** ...but never more than this share of lifetime souls (floor 10), so a boost spike cannot jackpot. */
export const REWARD_CAP_SHARE = 0.05;
export const IGNORE_GRACE_MS = 60_000;
/** Penalty per ignored incident ramps from 5% to 10% over the next 4 minutes; total capped at 15%. */
export const PENALTY_START = 0.05;
export const PENALTY_FULL = 0.1;
export const PENALTY_RAMP_MS = 240_000;
export const PENALTY_CAP = 0.15;

const SPOTS: [number, number][] = [[28, 14], [64, 14], [18, 40], [76, 44], [46, 70]];

export const nextSpawnDelay = (rng: () => number = Math.random): number =>
  SPAWN_MIN_MS + rng() * (SPAWN_MAX_MS - SPAWN_MIN_MS);

export const canSpawn = (activeCount: number, trainingStep: number): boolean =>
  trainingStep >= TRAINING_DONE && activeCount < MAX_ACTIVE;

export function makeIncident(id: number, nowMono: number, taken: Incident[], rng: () => number = Math.random): Incident {
  const free = SPOTS.filter(([x, y]) => !taken.some((i) => i.x === x && i.y === y));
  const [x, y] = free[Math.floor(rng() * free.length)] ?? SPOTS[0];
  const kinds = INCIDENT_KINDS.filter((k) => !taken.some((i) => i.kind === k));
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? INCIDENT_KINDS[0];
  return { id, kind, x, y, spawnedMono: nowMono, taps: 0, need: 3 + Math.floor(rng() * 3) };
}

/** Souls and KC a fix pays; KC keeps the ratio of the caller's current rates. */
export function incidentReward(soulsPerSec: Decimal, kcPerSec: Decimal, soulsLifetime: Decimal): { souls: Decimal; kc: Decimal } {
  if (soulsPerSec.lte(0)) return { souls: new Decimal(0), kc: new Decimal(0) };
  const cap = Decimal.max(soulsLifetime.mul(REWARD_CAP_SHARE), 10);
  const souls = Decimal.min(soulsPerSec.mul(REWARD_SECONDS), cap);
  return { souls, kc: souls.mul(kcPerSec).div(soulsPerSec) };
}

/** Fraction of office income one incident costs at this age (0 inside the grace period). */
export function incidentPenalty(ageMs: number): number {
  if (ageMs < IGNORE_GRACE_MS) return 0;
  const ramp = Math.min(1, (ageMs - IGNORE_GRACE_MS) / PENALTY_RAMP_MS);
  return PENALTY_START + (PENALTY_FULL - PENALTY_START) * ramp;
}

/** Office income factor (1 = no penalty), total penalty capped at PENALTY_CAP. */
export function incidentFactor(incidents: readonly Incident[], nowMono: number): number {
  let p = 0;
  for (const i of incidents) p += incidentPenalty(nowMono - i.spawnedMono);
  return 1 - Math.min(PENALTY_CAP, p);
}
