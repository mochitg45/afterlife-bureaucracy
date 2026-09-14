import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { findStaff, findUpgrade } from './content';
import { computeRates, staffBulkCost, maxAffordable, upgradeCost, upgradeLevel } from './economy';

export type BuyMode = 1 | 10 | 'max';

export function addSouls(state: GameState, souls: Decimal, kc: Decimal): GameState {
  return {
    ...state,
    soulsRun: state.soulsRun.add(souls),
    soulsLifetime: state.soulsLifetime.add(souls),
    kc: state.kc.add(kc),
  };
}

export function unlockDepartments(state: GameState, content: Content): GameState {
  const missing = content.departments
    .filter((d) => !state.deptsUnlocked.includes(d.id) && state.soulsRun.gte(d.unlockSouls))
    .map((d) => d.id);
  if (missing.length === 0) return state;
  return { ...state, deptsUnlocked: [...state.deptsUnlocked, ...missing] };
}

export function tick(state: GameState, content: Content, dtSec: number, nowMono: number): GameState {
  if (!(dtSec > 0)) return state;
  const rates = computeRates(state, content, nowMono);
  if (rates.soulsPerSec.eq(0)) return unlockDepartments(state, content);
  const next = addSouls(state, rates.soulsPerSec.mul(dtSec), rates.kcPerSec.mul(dtSec));
  return unlockDepartments(next, content);
}

export function click(state: GameState, content: Content, nowMono: number): GameState {
  const { clickPower } = computeRates(state, content, nowMono);
  const next = addSouls(state, clickPower, clickPower);
  return unlockDepartments({ ...next, stats: { ...next.stats, clicks: next.stats.clicks + 1 } }, content);
}

export function buyStaff(state: GameState, content: Content, staffId: string, mode: BuyMode): GameState {
  const { staff } = findStaff(content, staffId);
  const owned = state.staff[staffId] ?? 0;
  const count = mode === 'max' ? maxAffordable(staff, owned, state.kc) : mode;
  if (count <= 0) return state;
  const cost = staffBulkCost(staff, owned, count);
  if (cost.gt(state.kc)) return state;
  return {
    ...state,
    kc: state.kc.sub(cost),
    staff: { ...state.staff, [staffId]: owned + count },
    stats: { ...state.stats, staffHired: state.stats.staffHired + count },
  };
}

export function buyUpgrade(state: GameState, content: Content, upgradeId: string): GameState {
  const { upgrade } = findUpgrade(content, upgradeId);
  const level = upgradeLevel(state, upgradeId);
  if (level >= upgrade.maxLevel) return state;
  const cost = upgradeCost(upgrade, level);
  if (cost.gt(state.kc)) return state;
  return {
    ...state,
    kc: state.kc.sub(cost),
    upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
    stats: { ...state.stats, upgradesBought: state.stats.upgradesBought + 1 },
  };
}
