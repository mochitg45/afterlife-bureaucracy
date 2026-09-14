import Decimal from 'break_infinity.js';
import type { GameState, Stats, DailyBaseline } from './state';
import type { Content, DailyDef, DailyKind } from './content';
import { nextFloat } from './rng';
import { grantVouchers } from './vouchers';

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

export function pickTasks(content: Content, date: string): DailyDef[] {
  const pool = [...content.dailies];
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

const STAT_FOR_KIND: Record<DailyKind, keyof DailyBaseline> = {
  clicks: 'clicks',
  hire: 'staffHired',
  upgrades: 'upgradesBought',
  equip: 'equips',
  audit: 'audits',
  perk: 'perksBought',
  pulls: 'pulls',
};

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

export function progressOf(state: GameState, def: DailyDef): number {
  const key = STAT_FOR_KIND[def.kind];
  return Math.max(0, state.stats[key] - state.dailies.baseline[key]);
}

export function isDone(state: GameState, def: DailyDef): boolean {
  return state.dailies.skipped.includes(def.id) || progressOf(state, def) >= def.target;
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
      tasks: pickTasks(content, today).map((t) => ({ id: t.id, claimed: false })),
      skipped: [],
      streak,
      bestStreak,
      skipTokens,
      lastTokenDate,
      baseline: baselineFrom(state.stats),
      completedToday: false,
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
