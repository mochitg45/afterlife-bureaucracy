import Decimal from 'break_infinity.js';
import { createInitialState, type GameState } from './state';
import { content } from '../data';
import { loadContent, ALWAYS_AVAILABLE_DAILY_KINDS } from './content';
import intake from '../data/departments/intake.json';
import dailies from '../data/dailies.json';
import { dayKey, nextLocalMidnight, daysBetween, pickTasks, rollover, claimDaily, skipDaily, skipDailyFree, progressOf, isDone, TASKS_PER_DAY } from './dailies';
import { voucherMult, grantVouchers, grantVouchersExact } from './vouchers';

const now = { wall: 0, mono: 0 };
const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime();
const day = (n: number) => T0 + n * 86_400_000;
const KIND_STAT = { clicks: 'clicks', hire: 'staffHired', upgrades: 'upgradesBought', equip: 'equips', audit: 'audits', perk: 'perksBought', pulls: 'pulls', ad: 'adsWatched' } as const;
const GATED_KINDS = ['equip', 'audit', 'perk', 'pulls', 'ad'];
const fresh = () => createInitialState(now, content);
/** A player who has unlocked every gated task kind: cards owned, vouchers banked, Seals to spend, one audit filed. */
const unlockedAll = (): GameState => {
  const s = fresh();
  return { ...s, vouchers: 5, cards: { 'c-dave-overtime': 1 }, seals: 50, stats: { ...s.stats, audits: 1 } };
};

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
    const s = fresh();
    const a = pickTasks(content, '2026-09-14', s), b = pickTasks(content, '2026-09-14', s), c = pickTasks(content, '2026-09-15', s);
    expect(a).toHaveLength(TASKS_PER_DAY);
    expect(new Set(a.map((t) => t.kind)).size).toBe(3);
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
    expect(a.map((t) => t.id)).not.toEqual(c.map((t) => t.id));
  });
});

describe('task feasibility', () => {
  it('never offers a fresh save a task it cannot start, over a full year of dates', () => {
    const s = fresh();
    for (let i = 0; i < 365; i++) {
      const drawn = pickTasks(content, dayKey(day(i)), s);
      expect(drawn, dayKey(day(i))).toHaveLength(TASKS_PER_DAY);
      for (const t of drawn) expect(GATED_KINDS, `${dayKey(day(i))} drew ${t.id}`).not.toContain(t.kind);
    }
  });
  it('offers the ad task only when the store reports an ad network', () => {
    const s = unlockedAll();
    const drawn = (adsReady: boolean) => {
      const kinds = new Set<string>();
      for (let i = 0; i < 365; i++) for (const t of pickTasks(content, dayKey(day(i)), s, { adsReady })) kinds.add(t.kind);
      return kinds;
    };
    expect(drawn(false).has('ad')).toBe(false);
    expect(drawn(true).has('ad')).toBe(true);
  });
  it('offers gated kinds once the player can do them', () => {
    const s = unlockedAll();
    const kinds = new Set<string>();
    for (let i = 0; i < 365; i++) for (const t of pickTasks(content, dayKey(day(i)), s)) kinds.add(t.kind);
    expect([...kinds].some((k) => GATED_KINDS.includes(k))).toBe(true);
  });
  it('completes a rate task from the souls-per-second snapshot alone', () => {
    const s0 = fresh();
    const def = content.dailies.find((d) => d.kind === 'rate')!;
    const below = { ...s0, dailies: { ...s0.dailies, soulsPerSecSnapshot: String(def.target - 1) } };
    expect(progressOf(below, def)).toBe(def.target - 1);
    expect(isDone(below, def)).toBe(false);
    const at = { ...s0, dailies: { ...s0.dailies, soulsPerSecSnapshot: '1e30' } };
    expect(progressOf(at, def)).toBe(def.target);
    expect(isDone(at, def)).toBe(true);
  });
  it('rejects a daily pool without enough always-available kinds', () => {
    const gatedOnly = dailies.filter((d) => !ALWAYS_AVAILABLE_DAILY_KINDS.includes(d.kind as never));
    expect(() => loadContent([intake], [], { dailies: gatedOnly })).toThrow(/always-available/i);
    expect(() => loadContent([intake], [], { dailies })).not.toThrow();
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
    let soulsPerSecSnapshot = s.dailies.soulsPerSecSnapshot;
    for (const t of s.dailies.tasks) {
      const d = content.dailies.find((x) => x.id === t.id)!;
      if (d.kind === 'rate') { soulsPerSecSnapshot = String(d.target); continue; }
      const key = KIND_STAT[d.kind];
      stats[key] = s.dailies.baseline[key] + d.target;
    }
    return { ...s, stats, dailies: { ...s.dailies, soulsPerSecSnapshot } };
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
  it('writes a task off without a token for the rewarded-ad skip', () => {
    const s0 = rollover({ ...createInitialState(now, content), vouchers: 0 }, content, T0);
    const noTokens = { ...s0, dailies: { ...s0.dailies, skipTokens: 0 } };
    const id = noTokens.dailies.tasks[0].id;
    // A skip token would be refused here; the ad reward is not.
    expect(skipDaily(noTokens, content, id)).toBe(noTokens);
    const s1 = skipDailyFree(noTokens, content, id);
    expect(s1.dailies.skipped).toEqual([id]);
    expect(s1.dailies.skipTokens).toBe(0);
    // Already written off, so a second ad changes nothing.
    expect(skipDailyFree(s1, content, id)).toBe(s1);
    // The write-off is an instant completion, not a forfeit: the task is claimable and pays
    // its vouchers and KC like any other (spec §8).
    expect(isDone(s1, content.dailies.find((d) => d.id === id)!)).toBe(true);
    const claim = claimDaily(s1, content, id, new Decimal(1));
    expect(claim.vouchers).toBe(1);
    expect(claim.state.dailies.tasks.find((t) => t.id === id)!.claimed).toBe(true);
  });
  it('grants two exact vouchers on a rollover for a union member', () => {
    const s0 = { ...createInitialState(now, content), vouchers: 0, perks: ['requisition-1'] };
    expect(rollover(s0, content, T0, { unionActive: true }).vouchers).toBe(2);
    expect(rollover(s0, content, T0).vouchers).toBe(0);
  });
  it('grants the streak bonus on every 7th consecutive day', () => {
    let s = { ...ready() };
    s = { ...s, dailies: { ...s.dailies, streak: 6 } };
    for (const t of s.dailies.tasks) s = claimDaily(s, content, t.id, new Decimal(0)).state;
    expect(s.vouchers).toBe(3 + 3);
  });
  it('carries the sub-voucher remainder instead of rounding every grant up', () => {
    const s = { ...fresh(), perks: ['requisition-1'] };
    expect(voucherMult(s, content)).toBeCloseTo(1.1);
    const one = grantVouchers(s, content, 1);
    expect(one.vouchers).toBe(1);
    expect(one.voucherFraction).toBeCloseTo(0.1);
    let acc = s;
    for (let i = 0; i < 10; i++) acc = grantVouchers(acc, content, 1);
    expect(acc.vouchers).toBe(11);
    expect(acc.voucherFraction).toBeCloseTo(0);
    expect(grantVouchers(fresh(), content, 1).vouchers).toBe(1);
  });
  it('grants an exact voucher amount without the multiplier or the remainder', () => {
    const s = { ...fresh(), perks: ['requisition-1'], voucherFraction: 0.9 };
    const r = grantVouchersExact(s, 5);
    expect(r.vouchers).toBe(5);
    expect(r.voucherFraction).toBe(0.9);
    expect(grantVouchersExact(s, 0)).toBe(s);
  });
});
