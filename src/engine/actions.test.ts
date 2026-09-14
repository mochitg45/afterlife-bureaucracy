import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { loadContent, findStaff } from './content';
import intake from '../data/departments/intake.json';
import { tick, click, buyStaff, buyUpgrade, unlockDepartments, tickWithRates } from './actions';
import { staffBulkCost } from './economy';

const now = { wall: 0, mono: 0 };

describe('click', () => {
  it('adds click power to souls and kc 1:1 and counts the click', () => {
    const s0 = createInitialState(now, content);
    const s1 = click(s0, content, 0);
    expect(s1.soulsRun.toNumber()).toBe(1);
    expect(s1.soulsLifetime.toNumber()).toBe(1);
    expect(s1.kc.toNumber()).toBe(1);
    expect(s1.stats.clicks).toBe(1);
    expect(s0.kc.toNumber()).toBe(0); // no mutation
  });
});

describe('tick', () => {
  it('adds passive income scaled by dt with kc at 0.4', () => {
    const s0 = { ...createInitialState(now, content), staff: { dave: 1 } }; // 0.5 souls/s
    const s1 = tick(s0, content, 2, 0);
    expect(s1.soulsRun.toNumber()).toBeCloseTo(1);
    expect(s1.kc.toNumber()).toBeCloseTo(0.4);
  });
  it('does nothing for non-positive dt', () => {
    const s0 = { ...createInitialState(now, content), staff: { dave: 1 } };
    expect(tick(s0, content, 0, 0).soulsRun.toNumber()).toBe(0);
    expect(tick(s0, content, -5, 0).soulsRun.toNumber()).toBe(0);
  });
  it('tickWithRates returns the rates used for the tick', () => {
    const s0 = { ...createInitialState(now, content), staff: { dave: 1 } };
    const r = tickWithRates(s0, content, 2, 0);
    expect(r.rates.soulsPerSec.toNumber()).toBeCloseTo(0.5);
    expect(r.state.soulsRun.toNumber()).toBeCloseTo(1);
  });
});

describe('buyStaff', () => {
  const dave = findStaff(content, 'dave').staff;
  it('buys one when affordable and charges the unit cost', () => {
    const s0 = { ...createInitialState(now, content), kc: new Decimal(20) };
    const s1 = buyStaff(s0, content, 'dave', 1);
    expect(s1.staff.dave).toBe(1);
    expect(s1.kc.toNumber()).toBeCloseTo(5);
    expect(s1.stats.staffHired).toBe(1);
  });
  it('refuses when unaffordable', () => {
    const s0 = { ...createInitialState(now, content), kc: new Decimal(10) };
    const s1 = buyStaff(s0, content, 'dave', 1);
    expect(s1).toBe(s0);
  });
  it('buys 10 only if all 10 are affordable', () => {
    const cost10 = staffBulkCost(dave, 0, 10);
    const s0 = { ...createInitialState(now, content), kc: cost10 };
    expect(buyStaff(s0, content, 'dave', 10).staff.dave).toBe(10);
    const short = { ...s0, kc: cost10.sub(1) };
    expect(buyStaff(short, content, 'dave', 10)).toBe(short);
  });
  it('max buys as many as affordable', () => {
    const s0 = { ...createInitialState(now, content), kc: new Decimal(1000) };
    const s1 = buyStaff(s0, content, 'dave', 'max');
    expect(s1.staff.dave).toBeGreaterThan(10);
    expect(s1.kc.gte(0)).toBe(true);
    expect(staffBulkCost(dave, s1.staff.dave, 1).gt(s1.kc)).toBe(true);
  });
});

describe('buyUpgrade', () => {
  it('buys a level and charges the level cost', () => {
    const s0 = { ...createInitialState(now, content), kc: new Decimal(50) };
    const s1 = buyUpgrade(s0, content, 'faster-stapler');
    expect(s1.upgrades['faster-stapler']).toBe(1);
    expect(s1.kc.toNumber()).toBe(0);
    expect(s1.stats.upgradesBought).toBe(1);
  });
  it('refuses at max level', () => {
    const s0 = { ...createInitialState(now, content), kc: new Decimal('1e30'), upgrades: { 'faster-stapler': 10 } };
    expect(buyUpgrade(s0, content, 'faster-stapler')).toBe(s0);
  });
});

describe('unlockDepartments', () => {
  const two = loadContent([intake, { ...intake, id: 'heaven', name: 'Heaven Admissions', unlockSouls: 10000,
    staff: intake.staff.map((s) => ({ ...s, id: 'h-' + s.id })),
    upgrades: intake.upgrades.map((u) => ({ ...u, id: 'h-' + u.id })) }]);
  it('unlocks when souls this run reach the threshold', () => {
    const s0 = { ...createInitialState(now, content), soulsRun: new Decimal(9999) };
    expect(unlockDepartments(s0, two).deptsUnlocked).toEqual(['intake']);
    const s1 = unlockDepartments({ ...s0, soulsRun: new Decimal(10000) }, two);
    expect(s1.deptsUnlocked).toEqual(['intake', 'heaven']);
  });
  it('tick unlocks departments too', () => {
    const s0 = { ...createInitialState(now, content), staff: { dave: 1 }, soulsRun: new Decimal(9999.9) };
    expect(tick(s0, two, 1, 0).deptsUnlocked).toContain('heaven');
  });
});
