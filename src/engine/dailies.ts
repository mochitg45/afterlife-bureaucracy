import Decimal from 'break_infinity.js';
import type { GameState, Stats, DailyBaseline } from './state';
import type { Content, DailyDef, DailyKind } from './content';
import { nextFloat } from './rng';
import { grantVouchers } from './vouchers';
import { canAudit } from './prestige';
import { canBuyPerk } from './perks';

export const TASKS_PER_DAY = 3;
export const STREAK_BONUS_EVERY = 7;
export const STREAK_BONUS_VOUCHERS = 3;
export const TOKEN_EVERY_DAYS = 7;
export const DAILY_VOUCHERS = 1;
export const DAILY_KC_SECONDS = 300;
export const DAILY_KC_MIN = 50;

export function dayKey(wallMs: number): string {
  const d = new Date(wallMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nextLocalMidnight(wallMs: number): number {
  const d = new Date(wallMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((parseKey(b) - parseKey(a)) / 86_400_000);
}

function hashDate(key: string): number {
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/**
 * Whether today's player could actually finish a task of this kind. A day that offers
 * "equip a card" to someone with no cards, or "file an audit" to a first-day player, is a
 * task they can only skip.
 */
export function isKindFeasible(state: GameState, content: Content, kind: DailyKind): boolean {
  switch (kind) {
    case 'audit':
      // Past the first audit the threshold is always reachable within a day, so only the
      // player who has never closed a fiscal year needs to be within reach of one.
      return state.stats.audits > 0 || canAudit(state);
    case 'perk':
      return content.perks.some((p) => canBuyPerk(state, content, p.id).ok);
    case 'pulls':
      return state.vouchers >= 1;
    case 'equip':
      return Object.keys(state.cards).length > 0;
    default:
      return true;
  }
}

export function pickTasks(content: Content, date: string, state: GameState): DailyDef[] {
  const pool = content.dailies.filter((d) => isKindFeasible(state, content, d.kind));
  const out: DailyDef[] = [];
  let seed = hashDate(date);
  while (out.length < TASKS_PER_DAY && pool.length) {
    const r = nextFloat(seed);
    seed = r.seed;
    const [def] = pool.splice(Math.min(pool.length - 1, Math.floor(r.value * pool.length)), 1);
    if (out.some((o) => o.kind === def.kind)) continue;
    out.push(def);
  }
  return out;
}

/** Every kind but `rate`, which is measured against a snapshot rather than a counter. */
const STAT_FOR_KIND: Record<Exclude<DailyKind, 'rate'>, keyof DailyBaseline> = {
  clicks: 'clicks',
  hire: 'staffHired',
  upgrades: 'upgradesBought',
  equip: 'equips',
  audit: 'audits',
  perk: 'perksBought',
  pulls: 'pulls',
};

/** The two slices of state a daily's progress is read from; lets React subscribe to just these. */
export type DailyProgressView = Pick<GameState, 'stats' | 'dailies'>;

export function baselineFrom(stats: Stats): DailyBaseline {
  return {
    clicks: stats.clicks,
    staffHired: stats.staffHired,
    upgradesBought: stats.upgradesBought,
    equips: stats.equips,
    audits: stats.audits,
    perksBought: stats.perksBought,
    pulls: stats.pulls,
  };
}

export function progressOf(state: DailyProgressView, def: DailyDef): number {
  if (def.kind === 'rate') {
    // Reported as a plain number for the progress bar; a rate past the target is clamped to
    // it rather than overflowing a Decimal-sized souls/sec into the UI.
    const n = Number(state.dailies.soulsPerSecSnapshot);
    return Number.isFinite(n) ? Math.min(def.target, Math.max(0, n)) : 0;
  }
  const key = STAT_FOR_KIND[def.kind];
  return Math.max(0, state.stats[key] - state.dailies.baseline[key]);
}

export function isDone(state: DailyProgressView, def: DailyDef): boolean {
  if (state.dailies.skipped.includes(def.id)) return true;
  // The snapshot can run far past Number.MAX_SAFE_INTEGER, so the comparison stays in Decimal.
  if (def.kind === 'rate') return new Decimal(state.dailies.soulsPerSecSnapshot).gte(def.target);
  return progressOf(state, def) >= def.target;
}

export function rollover(state: GameState, content: Content, wallMs: number): GameState {
  const today = dayKey(wallMs);
  const d = state.dailies;
  if (d.date === today) return state;
  let streak = d.streak;
  if (d.date) streak = daysBetween(d.date, today) === 1 && d.completedToday ? streak + 1 : 0;
  const bestStreak = Math.max(d.bestStreak, streak);
  let skipTokens = d.skipTokens;
  let lastTokenDate = d.lastTokenDate;
  if (!lastTokenDate || daysBetween(lastTokenDate, today) >= TOKEN_EVERY_DAYS) {
    skipTokens = Math.min(1, skipTokens + 1);
    lastTokenDate = today;
  }
  return {
    ...state,
    dailies: {
      date: today,
      tasks: pickTasks(content, today, state).map((t) => ({ id: t.id, claimed: false })),
      skipped: [],
      streak,
      bestStreak,
      skipTokens,
      lastTokenDate,
      baseline: baselineFrom(state.stats),
      completedToday: false,
      soulsPerSecSnapshot: d.soulsPerSecSnapshot,
    },
  };
}

export function claimDaily(
  state: GameState,
  content: Content,
  taskId: string,
  kcPerSec: Decimal,
): { state: GameState; vouchers: number; kc: Decimal } {
  const zero = { state, vouchers: 0, kc: new Decimal(0) };
  const task = state.dailies.tasks.find((t) => t.id === taskId);
  const def = content.dailies.find((x) => x.id === taskId);
  if (!task || !def || task.claimed || !isDone(state, def)) return zero;
  const kc = Decimal.max(new Decimal(DAILY_KC_MIN), kcPerSec.mul(DAILY_KC_SECONDS));
  const tasks = state.dailies.tasks.map((t) => (t.id === taskId ? { ...t, claimed: true } : t));
  const allClaimed = tasks.every((t) => t.claimed);
  let next: GameState = {
    ...state,
    kc: state.kc.add(kc),
    dailies: { ...state.dailies, tasks, completedToday: allClaimed },
    stats: { ...state.stats, dailiesClaimed: state.stats.dailiesClaimed + 1 },
  };
  const before = next.vouchers;
  next = grantVouchers(next, content, DAILY_VOUCHERS);
  // streak + 1 anticipates tonight's rollover, which will count today as completed.
  if (allClaimed && (state.dailies.streak + 1) % STREAK_BONUS_EVERY === 0) next = grantVouchers(next, content, STREAK_BONUS_VOUCHERS);
  return { state: next, vouchers: next.vouchers - before, kc };
}

export function skipDaily(state: GameState, content: Content, taskId: string): GameState {
  const task = state.dailies.tasks.find((t) => t.id === taskId);
  const def = content.dailies.find((x) => x.id === taskId);
  if (!task || !def || task.claimed || state.dailies.skipTokens < 1 || isDone(state, def)) return state;
  return { ...state, dailies: { ...state.dailies, skipTokens: state.dailies.skipTokens - 1, skipped: [...state.dailies.skipped, taskId] } };
}
