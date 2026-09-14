import Decimal from 'break_infinity.js';
import { migrate, SAVE_VERSION } from './migrations';
import type { Content } from './content';

export { SAVE_VERSION };

export interface Stats { clicks: number; staffHired: number; upgradesBought: number; audits: number }

export interface GameState {
  saveVersion: number;
  kc: Decimal;
  soulsRun: Decimal;
  soulsLifetime: Decimal;
  seals: number;
  vouchers: number;
  perks: string[];
  staff: Record<string, number>;
  upgrades: Record<string, number>;
  deptsUnlocked: string[];
  activeDept: string;
  fiscalYear: number;
  /** Wall-clock ms-epoch deadline for the Overtime Boost; 0 when no boost is running. */
  boostUntilWall: number;
  lastSeenWallClock: number;
  uptimeAtSave: number;
  stats: Stats;
}

export interface Now { wall: number; mono: number }

/** Departments that cost nothing to open are unlocked from the first day on the job. */
export function startingDepartments(content: Content): string[] {
  return content.departments.filter((d) => d.unlockSouls === 0).map((d) => d.id);
}

export function createInitialState(now: Now, content: Content): GameState {
  const deptsUnlocked = startingDepartments(content);
  return {
    saveVersion: SAVE_VERSION,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    soulsLifetime: new Decimal(0),
    seals: 0,
    vouchers: 0,
    perks: [],
    staff: {},
    upgrades: {},
    deptsUnlocked,
    activeDept: deptsUnlocked[0],
    fiscalYear: 1,
    boostUntilWall: 0,
    lastSeenWallClock: now.wall,
    uptimeAtSave: now.mono,
    stats: { clicks: 0, staffHired: 0, upgradesBought: 0, audits: 0 },
  };
}

const DECIMAL_FIELDS = ['kc', 'soulsRun', 'soulsLifetime'] as const;

export function serialize(state: GameState): string {
  const raw: Record<string, unknown> = { ...state };
  for (const f of DECIMAL_FIELDS) raw[f] = state[f].toString();
  return JSON.stringify(raw);
}

/** Numbers written by an older build (or a hand-edited save) may arrive as numeric strings. */
function num(v: unknown, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** A garbled Decimal must never take the whole save down with it. */
function dec(v: unknown): Decimal {
  try {
    const d = new Decimal(String(v ?? '0'));
    return Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

/** Owned-count maps: coerce to numbers, drop anything non-finite or negative. */
function counts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    const n = num(raw, -1);
    if (n >= 0) out[key] = n;
  }
  return out;
}

export function deserialize(json: string, content: Content): GameState {
  const raw = migrate(JSON.parse(json) as Record<string, unknown>);
  const base = createInitialState({ wall: 0, mono: 0 }, content);
  const rawStats = (raw.stats ?? {}) as Record<string, unknown>;
  // A save may name a department this build does not ship (a removed one, or one from a
  // newer build rolled back). Drop those rather than booting into a department that
  // findDepartment() will throw on.
  const known = new Set(content.departments.map((d) => d.id));
  const kept = Array.isArray(raw.deptsUnlocked)
    ? (raw.deptsUnlocked as unknown[]).filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  const deptsUnlocked = kept.length ? kept : base.deptsUnlocked;
  return {
    ...base,
    saveVersion: SAVE_VERSION,
    kc: dec(raw.kc),
    soulsRun: dec(raw.soulsRun),
    soulsLifetime: dec(raw.soulsLifetime),
    seals: num(raw.seals, 0),
    vouchers: num(raw.vouchers, 0),
    perks: Array.isArray(raw.perks) ? (raw.perks as unknown[]).filter((p): p is string => typeof p === 'string') : [],
    staff: counts(raw.staff),
    upgrades: counts(raw.upgrades),
    deptsUnlocked,
    activeDept: deptsUnlocked.includes(raw.activeDept as string) ? (raw.activeDept as string) : deptsUnlocked[0],
    fiscalYear: num(raw.fiscalYear, 1),
    boostUntilWall: num(raw.boostUntilWall, 0),
    lastSeenWallClock: num(raw.lastSeenWallClock, 0),
    uptimeAtSave: num(raw.uptimeAtSave, 0),
    stats: {
      clicks: num(rawStats.clicks, 0),
      staffHired: num(rawStats.staffHired, 0),
      upgradesBought: num(rawStats.upgradesBought, 0),
      audits: num(rawStats.audits, 0),
    },
  };
}
