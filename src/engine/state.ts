import Decimal from 'break_infinity.js';
import { migrate, SAVE_VERSION } from './migrations';

export { SAVE_VERSION };

export interface Stats { clicks: number; staffHired: number; upgradesBought: number; audits: number }

export interface GameState {
  saveVersion: number;
  kc: Decimal;
  soulsRun: Decimal;
  soulsLifetime: Decimal;
  seals: number;
  vouchers: number;
  staff: Record<string, number>;
  upgrades: Record<string, number>;
  deptsUnlocked: string[];
  activeDept: string;
  fiscalYear: number;
  boostUntil: number;
  lastSeenWallClock: number;
  uptimeAtSave: number;
  stats: Stats;
}

export interface Now { wall: number; mono: number }

export function createInitialState(now: Now): GameState {
  return {
    saveVersion: SAVE_VERSION,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    soulsLifetime: new Decimal(0),
    seals: 0,
    vouchers: 0,
    staff: {},
    upgrades: {},
    deptsUnlocked: ['intake'],
    activeDept: 'intake',
    fiscalYear: 1,
    boostUntil: 0,
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

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function deserialize(json: string): GameState {
  const raw = migrate(JSON.parse(json) as Record<string, unknown>);
  const base = createInitialState({ wall: 0, mono: 0 });
  const rawStats = (raw.stats ?? {}) as Record<string, unknown>;
  return {
    ...base,
    saveVersion: SAVE_VERSION,
    kc: new Decimal(String(raw.kc ?? '0')),
    soulsRun: new Decimal(String(raw.soulsRun ?? '0')),
    soulsLifetime: new Decimal(String(raw.soulsLifetime ?? '0')),
    seals: num(raw.seals, 0),
    vouchers: num(raw.vouchers, 0),
    staff: { ...((raw.staff as Record<string, number>) ?? {}) },
    upgrades: { ...((raw.upgrades as Record<string, number>) ?? {}) },
    deptsUnlocked: Array.isArray(raw.deptsUnlocked) && raw.deptsUnlocked.length ? [...(raw.deptsUnlocked as string[])] : ['intake'],
    activeDept: typeof raw.activeDept === 'string' ? raw.activeDept : 'intake',
    fiscalYear: num(raw.fiscalYear, 1),
    boostUntil: num(raw.boostUntil, 0),
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
