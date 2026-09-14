import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { findStaff, findUpgrade, findPerk } from './content';
import { computeRates, staffBulkCost, maxAffordable, upgradeCost, upgradeLevel, type Rates } from './economy';
import { canBuyPerk } from './perks';

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

export interface TickResult { state: GameState; rates: Rates }

export function tickWithRates(state: GameState, content: Content, dtSec: number, nowWall: number): TickResult {
  const rates = computeRates(state, content, nowWall);
  if (!(dtSec > 0) || rates.soulsPerSec.eq(0)) return { state: unlockDepartments(state, content), rates };
  const next = addSouls(state, rates.soulsPerSec.mul(dtSec), rates.kcPerSec.mul(dtSec));
  return { state: unlockDepartments(next, content), rates };
}

export function tick(state: GameState, content: Content, dtSec: number, nowWall: number): GameState {
  if (!(dtSec > 0)) return state;
  return tickWithRates(state, content, dtSec, nowWall).state;
}

export function click(state: GameState, content: Content, nowWall: number): GameState {
  const { clickPower } = computeRates(state, content, nowWall);
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

export function buyPerk(state: GameState, content: Content, perkId: string): GameState {
  if (!canBuyPerk(state, content, perkId).ok) return state;
  const perk = findPerk(content, perkId);
  return { ...state, seals: state.seals - perk.cost, perks: [...state.perks, perkId], stats: { ...state.stats, perksBought: state.stats.perksBought + 1 } };
}
