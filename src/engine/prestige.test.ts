import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { sealsForRun, canAudit, fileAudit, AUDIT_THRESHOLD } from './prestige';

const now = { wall: 0, mono: 0 };

describe('sealsForRun', () => {
  it('is zero below the threshold and grows with the square root', () => {
    expect(sealsForRun(new Decimal(999_999))).toBe(0);
    expect(sealsForRun(new Decimal(AUDIT_THRESHOLD))).toBe(1);
    expect(sealsForRun(new Decimal(4_000_000))).toBe(2);
    expect(sealsForRun(new Decimal(1e8))).toBe(10);
    expect(sealsForRun(new Decimal('1e14'))).toBe(10_000);
  });
});

describe('fileAudit', () => {
  const rich = () => ({
    ...createInitialState(now, content),
    kc: new Decimal(123),
    soulsRun: new Decimal(9_000_000),
    soulsLifetime: new Decimal(9_500_000),
    staff: { dave: 50, 'h-cherub': 3 },
    upgrades: { 'faster-stapler': 2 },
    deptsUnlocked: ['intake', 'heaven'],
    activeDept: 'heaven',
    vouchers: 4,
    perks: ['throughput-1'],
    boostUntilWall: 5,
    stats: { clicks: 10, staffHired: 53, upgradesBought: 2, audits: 0 },
  });
  it('refuses below the threshold', () => {
    const s = { ...rich(), soulsRun: new Decimal(10) };
    const r = fileAudit(s, content);
    expect(r.state).toBe(s);
    expect(r.sealsGained).toBe(0);
  });
  it('resets the run, keeps the meta, grants seals', () => {
    const s = rich();
    const r = fileAudit(s, content);
    expect(r.sealsGained).toBe(3);
    expect(r.state.seals).toBe(3);
    expect(r.state.fiscalYear).toBe(2);
    expect(r.fiscalYear).toBe(2);
    expect(r.state.kc.toNumber()).toBe(0);
    expect(r.state.soulsRun.toNumber()).toBe(0);
    expect(r.state.soulsLifetime.toNumber()).toBe(9_500_000);
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
  it('canAudit follows the threshold', () => {
    expect(canAudit({ ...rich(), soulsRun: new Decimal(AUDIT_THRESHOLD - 1) })).toBe(false);
    expect(canAudit(rich())).toBe(true);
  });
});
