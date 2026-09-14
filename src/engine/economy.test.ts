import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { findStaff, findUpgrade } from './content';
import {
  staffUnitCost, staffBulkCost, maxAffordable, milestoneMult, nextMilestone, prevMilestone,
  upgradeCost, staplerLevel, deptMult, globalMult, computeRates,
} from './economy';

const now = { wall: 0, mono: 0 };
const dave = findStaff(content, 'dave').staff;

describe('staff cost', () => {
  it('grows by 1.15 per unit owned', () => {
    expect(staffUnitCost(dave, 0).toNumber()).toBeCloseTo(15);
    expect(staffUnitCost(dave, 1).toNumber()).toBeCloseTo(17.25);
    expect(staffUnitCost(dave, 10).toNumber()).toBeCloseTo(15 * 1.15 ** 10);
  });
  it('bulk cost equals the sum of unit costs', () => {
    const sum = [0, 1, 2, 3, 4].reduce((acc, i) => acc + staffUnitCost(dave, i).toNumber(), 0);
    expect(staffBulkCost(dave, 0, 5).toNumber()).toBeCloseTo(sum, 6);
  });
  it('maxAffordable matches bulk cost', () => {
    const kc = new Decimal(200);
    const n = maxAffordable(dave, 0, kc);
    expect(staffBulkCost(dave, 0, n).lte(kc)).toBe(true);
    expect(staffBulkCost(dave, 0, n + 1).gt(kc)).toBe(true);
    expect(maxAffordable(dave, 0, new Decimal(0))).toBe(0);
  });
});

describe('milestones', () => {
  it('doubles at 10, 25, 50, 100, 200 ... then every 100', () => {
    expect(milestoneMult(9).toNumber()).toBe(1);
    expect(milestoneMult(10).toNumber()).toBe(2);
    expect(milestoneMult(25).toNumber()).toBe(4);
    expect(milestoneMult(50).toNumber()).toBe(8);
    expect(milestoneMult(100).toNumber()).toBe(16);
    expect(milestoneMult(500).toNumber()).toBe(256);
    expect(milestoneMult(600).toNumber()).toBe(512);
    expect(milestoneMult(1000).toNumber()).toBe(2 ** 13);
  });
  it('reports next and previous milestones', () => {
    expect(nextMilestone(0)).toBe(10);
    expect(nextMilestone(10)).toBe(25);
    expect(nextMilestone(500)).toBe(600);
    expect(nextMilestone(650)).toBe(700);
    expect(prevMilestone(0)).toBe(0);
    expect(prevMilestone(10)).toBe(10);
    expect(prevMilestone(30)).toBe(25);
    expect(prevMilestone(650)).toBe(600);
  });
});

describe('upgrades and multipliers', () => {
  it('upgrade cost grows by costGrowth per level', () => {
    const u = findUpgrade(content, 'faster-stapler').upgrade;
    expect(upgradeCost(u, 0).toNumber()).toBe(50);
    expect(upgradeCost(u, 2).toNumber()).toBe(50 * 16);
  });
  it('stapler level sums click upgrades', () => {
    const s = createInitialState(now, content);
    expect(staplerLevel(s, content)).toBe(0);
    s.upgrades['faster-stapler'] = 3;
    expect(staplerLevel(s, content)).toBe(3);
  });
  it('department multiplier compounds deptMult upgrades', () => {
    const s = createInitialState(now, content);
    const intake = content.departments[0];
    expect(deptMult(s, intake).toNumber()).toBe(1);
    s.upgrades['ergonomic-chairs'] = 2;
    s.upgrades['outsourced-purgatory'] = 1;
    expect(deptMult(s, intake).toNumber()).toBeCloseTo(1.25 * 1.25 * 2);
  });
  it('global multiplier uses seals and boost', () => {
    const s = createInitialState(now, content);
    expect(globalMult(s, content, 0).toNumber()).toBe(1);
    s.seals = 10;
    expect(globalMult(s, content, 0).toNumber()).toBeCloseTo(1.2);
    s.boostUntilWall = 10_000;
    expect(globalMult(s, content, 5_000).toNumber()).toBeCloseTo(2.4);
    expect(globalMult(s, content, 10_000).toNumber()).toBeCloseTo(1.2);
  });
});

describe('computeRates', () => {
  it('is zero with no staff and click power 1', () => {
    const r = computeRates(createInitialState(now, content), content, 0);
    expect(r.soulsPerSec.toNumber()).toBe(0);
    expect(r.kcPerSec.toNumber()).toBe(0);
    expect(r.clickPower.toNumber()).toBe(1);
  });
  it('sums staff output with milestones, dept and global multipliers', () => {
    const s = createInitialState(now, content);
    s.staff.dave = 10;      // 0.5 × 10 × 2 (milestone) = 10
    s.staff.seraphine = 1;  // 2
    s.upgrades['ergonomic-chairs'] = 1; // ×1.25
    s.seals = 50;           // ×2
    const r = computeRates(s, content, 0);
    expect(r.soulsPerSec.toNumber()).toBeCloseTo(12 * 1.25 * 2);
    expect(r.kcPerSec.toNumber()).toBeCloseTo(12 * 1.25 * 2 * 0.4);
    expect(r.byStaff.dave.toNumber()).toBeCloseTo(10 * 1.25 * 2);
  });
  it('click power adds stapler level and 1% of passive', () => {
    const s = createInitialState(now, content);
    s.staff.dave = 200; // 0.5 × 200 × 32 = 3200/s
    s.upgrades['faster-stapler'] = 4;
    const r = computeRates(s, content, 0);
    expect(r.clickPower.toNumber()).toBeCloseTo(5 + 32);
  });
});
