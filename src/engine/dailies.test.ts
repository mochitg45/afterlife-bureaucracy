import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { dayKey, nextLocalMidnight, daysBetween, pickTasks, rollover, claimDaily, skipDaily, progressOf, isDone, TASKS_PER_DAY } from './dailies';
import { voucherMult, grantVouchers } from './vouchers';

const now = { wall: 0, mono: 0 };
const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime();
const day = (n: number) => T0 + n * 86_400_000;
const KIND_STAT = { clicks: 'clicks', hire: 'staffHired', upgrades: 'upgradesBought', equip: 'equips', audit: 'audits', perk: 'perksBought', pulls: 'pulls' } as const;

describe('day helpers', () => {
  it('formats local day keys and computes midnight and day gaps', () => {
    expect(dayKey(T0)).toBe('2026-09-14');
    expect(dayKey(nextLocalMidnight(T0))).toBe('2026-09-15');
    expect(nextLocalMidnight(T0)).toBeGreaterThan(T0);
    expect(daysBetween('2026-09-14', '2026-09-16')).toBe(2);
    expect(daysBetween('2026-09-14', '2026-09-14')).toBe(0);
    expect(daysBetween('', '2026-09-14')).toBe(0);
  });
  it('picks 3 tasks of distinct kinds deterministically per date', () => {
    const a = pickTasks(content, '2026-09-14'), b = pickTasks(content, '2026-09-14'), c = pickTasks(content, '2026-09-15');
    expect(a).toHaveLength(TASKS_PER_DAY);
    expect(new Set(a.map((t) => t.kind)).size).toBe(3);
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
    expect(a.map((t) => t.id)).not.toEqual(c.map((t) => t.id));
  });
});

describe('rollover and progress', () => {
  it('assigns tasks and a baseline on the first day', () => {
    const s0 = createInitialState(now, content);
    const s = rollover({ ...s0, stats: { ...s0.stats, clicks: 40 } }, content, T0);
    expect(s.dailies.date).toBe('2026-09-14');
    expect(s.dailies.tasks).toHaveLength(3);
    expect(s.dailies.baseline.clicks).toBe(40);
    expect(rollover(s, content, T0 + 1000)).toBe(s);
  });
  it('measures progress from the baseline', () => {
    const s0 = rollover(createInitialState(now, content), content, T0);
    const def = content.dailies.find((d) => d.kind === 'clicks')!;
    expect(progressOf(s0, def)).toBe(0);
    const s1 = { ...s0, stats: { ...s0.stats, clicks: def.target + 5 } };
    expect(progressOf(s1, def)).toBe(def.target + 5);
    expect(isDone(s1, def)).toBe(true);
  });
  it('increments the streak only after a fully completed day, resets after a gap', () => {
    let s = rollover(createInitialState(now, content), content, T0);
    s = rollover({ ...s, dailies: { ...s.dailies, completedToday: true } }, content, day(1));
    expect(s.dailies.streak).toBe(1);
    s = rollover({ ...s, dailies: { ...s.dailies, completedToday: true } }, content, day(2));
    expect(s.dailies.streak).toBe(2);
    expect(s.dailies.bestStreak).toBe(2);
    s = rollover(s, content, day(4));
    expect(s.dailies.streak).toBe(0);
    expect(s.dailies.bestStreak).toBe(2);
  });
  it('grants one skip token per 7 days, capped at one', () => {
    let s = rollover(createInitialState(now, content), content, T0);
    expect(s.dailies.skipTokens).toBe(1);
    s = rollover(s, content, day(3));
    expect(s.dailies.skipTokens).toBe(1);
    s = rollover({ ...s, dailies: { ...s.dailies, skipTokens: 0 } }, content, day(6));
    expect(s.dailies.skipTokens).toBe(0);
    s = rollover(s, content, day(7));
    expect(s.dailies.skipTokens).toBe(1);
  });
});

describe('claim and skip', () => {
  const ready = () => {
    const s = rollover({ ...createInitialState(now, content), vouchers: 0 }, content, T0);
    const stats = { ...s.stats };
    for (const t of s.dailies.tasks) {
      const d = content.dailies.find((x) => x.id === t.id)!;
      const key = KIND_STAT[d.kind];
      stats[key] = s.dailies.baseline[key] + d.target;
    }
    return { ...s, stats };
  };
  it('pays vouchers and KC once per task and completes the day', () => {
    let s = ready();
    const ids = s.dailies.tasks.map((t) => t.id);
    const r1 = claimDaily(s, content, ids[0], new Decimal(2));
    expect(r1.vouchers).toBe(1);
    expect(r1.kc.toNumber()).toBe(600);
    s = r1.state;
    expect(s.vouchers).toBe(1);
    expect(s.stats.dailiesClaimed).toBe(1);
    expect(claimDaily(s, content, ids[0], new Decimal(2)).state).toBe(s);
    s = claimDaily(s, content, ids[1], new Decimal(0)).state;
    expect(s.kc.toNumber()).toBe(650);
    s = claimDaily(s, content, ids[2], new Decimal(0)).state;
    expect(s.dailies.completedToday).toBe(true);
  });
  it('refuses an unfinished task; skip spends a token', () => {
    const s0 = rollover({ ...createInitialState(now, content), vouchers: 0 }, content, T0);
    const id = s0.dailies.tasks[0].id;
    expect(claimDaily(s0, content, id, new Decimal(1)).state).toBe(s0);
    const s1 = skipDaily(s0, content, id);
    expect(s1.dailies.skipTokens).toBe(0);
    expect(claimDaily(s1, content, id, new Decimal(1)).vouchers).toBe(1);
    expect(skipDaily(s1, content, s1.dailies.tasks[1].id)).toBe(s1);
  });
  it('grants the streak bonus on every 7th consecutive day', () => {
    let s = { ...ready() };
    s = { ...s, dailies: { ...s.dailies, streak: 6 } };
    for (const t of s.dailies.tasks) s = claimDaily(s, content, t.id, new Decimal(0)).state;
    expect(s.vouchers).toBe(3 + 3);
  });
  it('voucher multiplier rounds up', () => {
    const s = { ...createInitialState(now, content), perks: ['requisition-1'] };
    expect(voucherMult(s, content)).toBeCloseTo(1.1);
    expect(grantVouchers(s, content, 1).vouchers).toBe(2);
    expect(grantVouchers(createInitialState(now, content), content, 1).vouchers).toBe(1);
  });
});
