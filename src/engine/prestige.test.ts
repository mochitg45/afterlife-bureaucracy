import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import {
  sealsForRun, canAudit, fileAudit, resetRun, auditThreshold,
  AUDIT_BASE, SEAL_COEFF, YEAR_GROWTH,
} from './prestige';

const now = { wall: 0, mono: 0 };

describe('auditThreshold', () => {
  it('is the base in year 1 and scales by YEAR_GROWTH each year after', () => {
    expect(auditThreshold(1).eq(AUDIT_BASE)).toBe(true);
    expect(auditThreshold(2).eq(new Decimal(AUDIT_BASE).mul(YEAR_GROWTH))).toBe(true);
    expect(auditThreshold(3).eq(new Decimal(AUDIT_BASE).mul(YEAR_GROWTH ** 2))).toBe(true);
  });
});

describe('sealsForRun', () => {
  it('pays SEAL_COEFF for a run that lands exactly on the year-1 threshold', () => {
    expect(sealsForRun(new Decimal(AUDIT_BASE), 1)).toBe(SEAL_COEFF);
  });
  it('is zero below the year threshold', () => {
    expect(sealsForRun(new Decimal(AUDIT_BASE).sub(1), 1)).toBe(0);
    // The same run that pays out in year 1 is short of year 2's raised bar.
    expect(sealsForRun(new Decimal(AUDIT_BASE), 2)).toBe(0);
  });
  it('grows sub-linearly with the size of the run', () => {
    const ten = sealsForRun(new Decimal(AUDIT_BASE).mul(10), 1);
    const hundred = sealsForRun(new Decimal(AUDIT_BASE).mul(100), 1);
    expect(ten).toBe(Math.floor(SEAL_COEFF * 10 ** 0.4));
    expect(hundred).toBe(Math.floor(SEAL_COEFF * 100 ** 0.4));
    // Ten times the souls is well short of ten times the Seals.
    expect(ten).toBeLessThan(10 * SEAL_COEFF);
  });
  it('clamps absurd runs to a safe integer instead of overflowing', () => {
    expect(sealsForRun(new Decimal('1e100'), 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(sealsForRun(new Decimal('1e1000'), 1)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('canAudit', () => {
  it('respects the fiscal year the run belongs to', () => {
    const soulsRun = new Decimal(AUDIT_BASE);
    expect(canAudit({ soulsRun, fiscalYear: 1 })).toBe(true);
    expect(canAudit({ soulsRun, fiscalYear: 2 })).toBe(false);
    expect(canAudit({ soulsRun: soulsRun.mul(YEAR_GROWTH), fiscalYear: 2 })).toBe(true);
  });
});

describe('resetRun', () => {
  it('clears the run and keeps the meta, without touching Seals or the year', () => {
    const s = {
      ...createInitialState(now, content),
      kc: new Decimal(99), soulsRun: new Decimal(1234), soulsLifetime: new Decimal(5678),
      staff: { dave: 4 }, upgrades: { 'faster-stapler': 1 },
      deptsUnlocked: ['intake', 'heaven'], activeDept: 'heaven',
      seals: 7, fiscalYear: 3, perks: ['throughput-1'],
    };
    const r = resetRun(s, content);
    expect(r.kc.eq(0)).toBe(true);
    expect(r.soulsRun.eq(0)).toBe(true);
    expect(r.soulsLifetime.eq(5678)).toBe(true);
    expect(r.staff).toEqual({});
    expect(r.upgrades).toEqual({});
    expect(r.deptsUnlocked).toEqual(['intake']);
    expect(r.activeDept).toBe('intake');
    expect(r.seals).toBe(7);
    expect(r.fiscalYear).toBe(3);
    expect(s.staff.dave).toBe(4); // no mutation
  });
  it('restores the head start the player bought', () => {
    const s = { ...createInitialState(now, content), perks: ['headstart-1', 'headstart-2', 'headstart-3'] };
    const r = resetRun(s, content);
    expect(r.staff).toEqual({ dave: 10, seraphine: 10 });
    expect(r.deptsUnlocked).toEqual(['intake', 'heaven']);
  });
});

describe('fileAudit', () => {
  const rich = () => ({
    ...createInitialState(now, content),
    kc: new Decimal(123),
    soulsRun: new Decimal(AUDIT_BASE).mul(9),
    soulsLifetime: new Decimal(AUDIT_BASE).mul(9).add(500_000),
    staff: { dave: 50, 'h-cherub': 3 },
    upgrades: { 'faster-stapler': 2 },
    deptsUnlocked: ['intake', 'heaven'],
    activeDept: 'heaven',
    vouchers: 4,
    perks: ['throughput-1'],
    boostUntilWall: 5,
    stats: { clicks: 10, staffHired: 53, upgradesBought: 2, audits: 0 },
  });
  const expected = Math.floor(SEAL_COEFF * 9 ** 0.4);
  it('refuses below the threshold', () => {
    const s = { ...rich(), soulsRun: new Decimal(10) };
    const r = fileAudit(s, content);
    expect(r.state).toBe(s);
    expect(r.sealsGained).toBe(0);
  });
  it('refuses a year-1-sized run once the fiscal year has moved on', () => {
    const s = { ...rich(), soulsRun: new Decimal(AUDIT_BASE), fiscalYear: 4 };
    expect(fileAudit(s, content).sealsGained).toBe(0);
  });
  it('resets the run, keeps the meta, grants seals', () => {
    const s = rich();
    const r = fileAudit(s, content);
    expect(r.sealsGained).toBe(expected);
    expect(r.state.seals).toBe(expected);
    expect(r.state.fiscalYear).toBe(2);
    expect(r.fiscalYear).toBe(2);
    expect(r.state.kc.toNumber()).toBe(0);
    expect(r.state.soulsRun.toNumber()).toBe(0);
    expect(r.state.soulsLifetime.eq(new Decimal(AUDIT_BASE).mul(9).add(500_000))).toBe(true);
    expect(r.state.staff).toEqual({});
    expect(r.state.upgrades).toEqual({});
    expect(r.state.deptsUnlocked).toEqual(['intake']);
    expect(r.state.activeDept).toBe('intake');
    expect(r.state.vouchers).toBe(4);
    expect(r.state.perks).toEqual(['throughput-1']);
    expect(r.state.boostUntilWall).toBe(5);
    expect(r.state.stats.audits).toBe(1);
    expect(r.state.stats.clicks).toBe(10);
    expect(s.staff.dave).toBe(50); // no mutation
  });
  it('applies head-start perks after the reset', () => {
    const s = { ...rich(), perks: ['headstart-1', 'headstart-2', 'headstart-3'] };
    const r = fileAudit(s, content);
    expect(r.state.staff).toEqual({ dave: 10, seraphine: 10 });
    expect(r.state.deptsUnlocked).toEqual(['intake', 'heaven']);
    expect(r.state.activeDept).toBe('intake');
  });
  it('keeps the Seal total inside the safe integer range', () => {
    const s = { ...rich(), soulsRun: new Decimal('1e200'), seals: Number.MAX_SAFE_INTEGER - 1 };
    expect(fileAudit(s, content).state.seals).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('canAudit follows the threshold', () => {
    expect(canAudit({ ...rich(), soulsRun: new Decimal(AUDIT_BASE).sub(1) })).toBe(false);
    expect(canAudit(rich())).toBe(true);
  });
});
