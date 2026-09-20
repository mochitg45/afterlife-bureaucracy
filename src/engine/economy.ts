import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, DepartmentDef, StaffDef, UpgradeDef } from './content';
import { perkGlobalMult, perkDeptMult, perkSum } from './perks';
import { cardGlobalMult, cardDeptMult, cardClickMult } from './gacha';
import { achievementMult } from './achievements';
import { clauseGlobalMult } from './cosmic';
import { unionGlobalMult } from './entitlements';

export const COST_GROWTH = 1.15;
export const PASSIVE_KC_FRACTION = 0.4;
/**
 * How long the Overtime Boost ad runs the office at double rate, and how long the placement
 * stays closed afterwards: the four hours of boost plus a four-hour cooldown, so the reward
 * is at most half the day.
 *
 * They live here rather than in the store because `boostUntilWall` is engine state read by
 * `globalMult` below, and the balance simulator — which may not import the store — has to
 * model the same window the store grants.
 */
export const BOOST_AD_DURATION_MS = 4 * 3600_000;
export const BOOST_AD_COOLDOWN_MS = 8 * 3600_000;
const CLICK_PASSIVE_FRACTION = 0.01;
const FIXED_MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];

export function staffUnitCost(def: StaffDef, owned: number): Decimal {
  return new Decimal(def.baseCost).mul(Decimal.pow(COST_GROWTH, owned));
}

/**
 * Affordability with a hair of tolerance. The geometric cost series and the tick's rate maths
 * both leave float residue, so "15 Karma" on screen can sit at 14.999999999999998 underneath
 * and refuse a 15-Karma hire; a first-launch player stuck on "Hire Dave" was how it surfaced.
 */
export function canAfford(cost: Decimal, kc: Decimal): boolean {
  return cost.lte(kc.mul(1 + 1e-9));
}

export function staffBulkCost(def: StaffDef, owned: number, count: number): Decimal {
  if (count <= 0) return new Decimal(0);
  if (count === 1) return staffUnitCost(def, owned); // exact: the series form leaves residue
  // geometric series: unit × (r^count − 1) / (r − 1)
  const first = staffUnitCost(def, owned);
  return first.mul(Decimal.pow(COST_GROWTH, count).sub(1)).div(COST_GROWTH - 1);
}

export function maxAffordable(def: StaffDef, owned: number, kc: Decimal): number {
  const first = staffUnitCost(def, owned);
  if (kc.lt(first)) return 0;
  // n = floor(log_r(kc × (r−1) / first + 1))
  const inner = kc.mul(COST_GROWTH - 1).div(first).add(1);
  let n = Math.floor(inner.log10() / Math.log10(COST_GROWTH));
  // guard against floating error on the boundary
  while (n > 0 && !canAfford(staffBulkCost(def, owned, n), kc)) n--;
  while (canAfford(staffBulkCost(def, owned, n + 1), kc)) n++;
  return n;
}

function milestonesPassed(owned: number): number {
  let count = FIXED_MILESTONES.filter((m) => owned >= m).length;
  if (owned >= 600) count += Math.floor((owned - 500) / 100);
  return count;
}

export function milestoneMult(owned: number): Decimal {
  return Decimal.pow(2, milestonesPassed(owned));
}

export function nextMilestone(owned: number): number {
  for (const m of FIXED_MILESTONES) if (owned < m) return m;
  return (Math.floor(owned / 100) + 1) * 100;
}

export function prevMilestone(owned: number): number {
  if (owned >= 500) return Math.floor(owned / 100) * 100;
  let prev = 0;
  for (const m of FIXED_MILESTONES) if (owned >= m) prev = m;
  return prev;
}

export function upgradeCost(def: UpgradeDef, level: number): Decimal {
  return new Decimal(def.baseCost).mul(Decimal.pow(def.costGrowth, level));
}

export function upgradeLevel(state: GameState, upgradeId: string): number {
  return state.upgrades[upgradeId] ?? 0;
}

export function staplerLevel(state: GameState, content: Content): number {
  let level = 0;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'click') level += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return level + perkSum(state, content, 'click');
}

export function deptMult(state: GameState, content: Content, dept: DepartmentDef): Decimal {
  let mult = new Decimal(1);
  for (const u of dept.upgrades) {
    if (u.effect.type === 'deptMult') {
      mult = mult.mul(Decimal.pow(1 + u.effect.value, upgradeLevel(state, u.id)));
    }
  }
  return mult.mul(perkDeptMult(state, content, dept.id)).mul(cardDeptMult(state, content, dept.id));
}

export function globalMult(state: GameState, content: Content, nowWall: number): Decimal {
  const sealBonus = 1 + 0.02 * state.seals;
  const boost = state.boostUntilWall > nowWall ? 2 : 1;
  return new Decimal(sealBonus)
    .mul(boost)
    .mul(perkGlobalMult(state, content))
    .mul(cardGlobalMult(state, content))
    .mul(achievementMult(state))
    .mul(clauseGlobalMult(state, content))
    .mul(unionGlobalMult(state, nowWall));
}

export interface Rates {
  soulsPerSec: Decimal;
  kcPerSec: Decimal;
  clickPower: Decimal;
  byStaff: Record<string, Decimal>;
}

export function computeRates(state: GameState, content: Content, nowWall: number): Rates {
  const g = globalMult(state, content, nowWall);
  let souls = new Decimal(0);
  const byStaff: Record<string, Decimal> = {};
  for (const dept of content.departments) {
    const dm = deptMult(state, content, dept);
    for (const s of dept.staff) {
      const owned = state.staff[s.id] ?? 0;
      if (owned === 0) {
        byStaff[s.id] = new Decimal(0);
        continue;
      }
      const out = new Decimal(s.baseRate).mul(owned).mul(milestoneMult(owned)).mul(dm).mul(g);
      byStaff[s.id] = out;
      souls = souls.add(out);
    }
  }
  const clickPower = new Decimal(1 + staplerLevel(state, content)).add(souls.mul(CLICK_PASSIVE_FRACTION)).mul(1 + cardClickMult(state, content));
  return { soulsPerSec: souls, kcPerSec: souls.mul(PASSIVE_KC_FRACTION), clickPower, byStaff };
}
