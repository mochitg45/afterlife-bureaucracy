import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import {
  sealsForRun, canAudit, fileAudit, resetRun, auditThreshold,
  AUDIT_BASE, SEAL_COEFF, SEAL_CAP_PER_AUDIT, YEAR_GROWTH, sealCap,
  MIN_FISCAL_YEAR_MS, auditTimeLeftMs, canFileAudit, expediteCost, expediteAudit,
} from './prestige';

const now = { wall: 0, mono: 0 };
const LATE = MIN_FISCAL_YEAR_MS; // a wall clock a full fiscal year past the state's runStartWall of 0

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
    // A fraction under, not AUDIT_BASE − 1: at this size a single soul is below the float
    // resolution of the base and would compare equal to the threshold.
    expect(sealsForRun(new Decimal(AUDIT_BASE).mul(0.999), 1)).toBe(0);
    // The same run that pays out in year 1 is short of year 2's raised bar.
    expect(sealsForRun(new Decimal(AUDIT_BASE), 2)).toBe(0);
  });
  it('grows sub-linearly with the size of the run', () => {
    const two = sealsForRun(new Decimal(AUDIT_BASE).mul(2), 1);
    const five = sealsForRun(new Decimal(AUDIT_BASE).mul(5), 1);
    expect(two).toBe(Math.floor(SEAL_COEFF * 2 ** 0.4));
    expect(five).toBe(Math.floor(SEAL_COEFF * 5 ** 0.4));
    // Two and a half times the souls is well short of two and a half times the Seals, and
    // both payouts are under the cap, so this is the curve and not the ceiling talking.
    expect(five).toBeLessThan(2.5 * two);
    expect(five).toBeLessThan(5 * SEAL_COEFF);
    expect(five).toBeLessThan(SEAL_CAP_PER_AUDIT);
  });
  it('never pays more than the per-audit cap, however absurd the run', () => {
    expect(sealsForRun(new Decimal('1e100'), 1)).toBe(SEAL_CAP_PER_AUDIT);
    // Past the range of a JS number the payout is the cap too, not NaN or MAX_SAFE_INTEGER.
    expect(sealsForRun(new Decimal('1e1000'), 1)).toBe(SEAL_CAP_PER_AUDIT);
  });
  it('caps a merely large overshoot at SEAL_CAP_PER_AUDIT', () => {
    const uncapped = Math.floor(SEAL_COEFF * 1e6 ** 0.4);
    expect(uncapped).toBeGreaterThan(SEAL_CAP_PER_AUDIT);
    expect(sealsForRun(new Decimal(AUDIT_BASE).mul(1e6), 1)).toBe(SEAL_CAP_PER_AUDIT);
  });

  it('raises the cap by the Clause Seal multiplier, so the Clause is never cancelled out', () => {
    // A run already at the ceiling is exactly the run that bought "Audits pay double"; a flat
    // cap would have taken the whole purchase back.
    expect(sealCap()).toBe(SEAL_CAP_PER_AUDIT);
    expect(sealCap(1.5)).toBe(SEAL_CAP_PER_AUDIT * 1.5);
    expect(sealCap(3)).toBe(SEAL_CAP_PER_AUDIT * 3);
    const huge = new Decimal('1e100');
    expect(sealsForRun(huge, 1)).toBe(SEAL_CAP_PER_AUDIT);
    expect(sealsForRun(huge, 1, 1.5)).toBe(SEAL_CAP_PER_AUDIT * 1.5);
    expect(sealsForRun(huge, 1, 3)).toBe(SEAL_CAP_PER_AUDIT * 3);
    // A nonsense multiplier falls back to the flat cap rather than erasing it.
    expect(sealCap(0)).toBe(SEAL_CAP_PER_AUDIT);
    expect(sealCap(Number.NaN)).toBe(SEAL_CAP_PER_AUDIT);
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
    soulsRun: new Decimal(AUDIT_BASE).mul(4),
    soulsLifetime: new Decimal(AUDIT_BASE).mul(4).add(500_000),
    staff: { dave: 50, 'h-cherub': 3 },
    upgrades: { 'faster-stapler': 2 },
    deptsUnlocked: ['intake', 'heaven'],
    activeDept: 'heaven',
    vouchers: 4,
    perks: ['throughput-1'],
    boostUntilWall: 5,
    stats: { clicks: 10, staffHired: 53, upgradesBought: 2, audits: 0, pulls: 0, equips: 0, dailiesClaimed: 0, adsWatched: 0, perksBought: 0, cosmics: 0, purchases: 0 },
  });
  const expected = Math.floor(SEAL_COEFF * 4 ** 0.4);
  it('refuses below the threshold', () => {
    const s = { ...rich(), soulsRun: new Decimal(10) };
    const r = fileAudit(s, content, LATE);
    expect(r.state).toBe(s);
    expect(r.sealsGained).toBe(0);
  });
  it('refuses a year-1-sized run once the fiscal year has moved on', () => {
    const s = { ...rich(), soulsRun: new Decimal(AUDIT_BASE), fiscalYear: 4 };
    expect(fileAudit(s, content, LATE).sealsGained).toBe(0);
  });
  it('resets the run, keeps the meta, grants seals', () => {
    const s = rich();
    const r = fileAudit(s, content, LATE);
    expect(r.sealsGained).toBe(expected);
    expect(r.state.seals).toBe(expected);
    expect(r.state.fiscalYear).toBe(2);
    expect(r.fiscalYear).toBe(2);
    expect(r.state.kc.toNumber()).toBe(0);
    expect(r.state.soulsRun.toNumber()).toBe(0);
    expect(r.state.soulsLifetime.eq(new Decimal(AUDIT_BASE).mul(4).add(500_000))).toBe(true);
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
    const r = fileAudit(s, content, LATE);
    expect(r.state.staff).toEqual({ dave: 10, seraphine: 10 });
    expect(r.state.deptsUnlocked).toEqual(['intake', 'heaven']);
    expect(r.state.activeDept).toBe('intake');
  });
  it('keeps the Seal total inside the safe integer range', () => {
    const s = { ...rich(), soulsRun: new Decimal('1e200'), seals: Number.MAX_SAFE_INTEGER - 1 };
    expect(fileAudit(s, content, LATE).state.seals).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('refuses until the minimum fiscal year has elapsed, then sets runStartWall', () => {
    const s = rich();
    expect(fileAudit(s, content, LATE - 1).state).toBe(s);
    const r = fileAudit(s, content, LATE);
    expect(r.sealsGained).toBe(expected);
    expect(r.state.runStartWall).toBe(LATE);
  });
  it('trims equipped cards past the slot count the reset leaves behind', () => {
    const five = ['c-dave-overtime', 'c-seraphine-chipper', 'c-gary-break', 'c-cherub-choir', 'c-imp-qa'];
    // Five lanyards' worth of cards, but the perks that granted the extra slots are gone,
    // which is exactly the shape Cosmic Restructuring will hand resetRun.
    const s = { ...rich(), perks: [], cards: Object.fromEntries(five.map((id) => [id, 1])), equipped: five };
    expect(resetRun(s, content).equipped).toEqual(five.slice(0, 3));
  });
  it('keeps equipped cards the extra-slot perks still pay for', () => {
    const five = ['c-dave-overtime', 'c-seraphine-chipper', 'c-gary-break', 'c-cherub-choir', 'c-imp-qa'];
    const s = { ...rich(), perks: ['requisition-1', 'requisition-3', 'requisition-4'], cards: Object.fromEntries(five.map((id) => [id, 1])), equipped: five };
    expect(resetRun(s, content).equipped).toEqual(five);
  });
  it('canAudit follows the threshold', () => {
    expect(canAudit({ ...rich(), soulsRun: new Decimal(AUDIT_BASE).mul(0.999) })).toBe(false);
    expect(canAudit(rich())).toBe(true);
  });
});

describe('minimum fiscal year', () => {
  const HALF_HOUR = 30 * 60 * 1000;
  const ready = () => ({ ...createInitialState(now, content), soulsRun: new Decimal(AUDIT_BASE).mul(2), vouchers: 100 });
  it('auditTimeLeftMs counts down to runStartWall + MIN_FISCAL_YEAR_MS and floors at 0', () => {
    const s = ready();
    expect(auditTimeLeftMs(s, 0)).toBe(MIN_FISCAL_YEAR_MS);
    expect(auditTimeLeftMs(s, HALF_HOUR)).toBe(MIN_FISCAL_YEAR_MS - HALF_HOUR);
    expect(auditTimeLeftMs(s, MIN_FISCAL_YEAR_MS * 2)).toBe(0);
  });
  it('canFileAudit needs both the souls threshold and the clock', () => {
    const s = ready();
    expect(canFileAudit(s, 0)).toBe(false);
    expect(canFileAudit({ ...s, soulsRun: new Decimal(1) }, LATE)).toBe(false);
    expect(canFileAudit(s, LATE)).toBe(true);
  });
  it('expediteCost is one voucher per started 30 minutes left', () => {
    const s = ready();
    expect(expediteCost(s, 0)).toBe(16);
    expect(expediteCost(s, LATE - 29 * 60 * 1000)).toBe(1);
    expect(expediteCost(s, LATE)).toBe(0);
  });
  it('expediteAudit pays vouchers and opens the audit', () => {
    const s = ready();
    const r = expediteAudit(s, 0);
    expect(r.vouchers).toBe(100 - 16);
    expect(canFileAudit(r, 0)).toBe(true);
    expect(r.runStartWall).toBe(-MIN_FISCAL_YEAR_MS);
  });
  it('expediteAudit is refused without vouchers, without the souls, or with nothing to wait for', () => {
    const s = ready();
    const poor = { ...s, vouchers: 15 };
    expect(expediteAudit(poor, 0)).toBe(poor);
    const short = { ...s, soulsRun: new Decimal(1) };
    expect(expediteAudit(short, 0)).toBe(short);
    expect(expediteAudit(s, LATE)).toBe(s);
  });
});
