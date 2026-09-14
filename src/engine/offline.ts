import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { computeRates, upgradeLevel } from './economy';
import { addSouls } from './actions';

export const BASE_OFFLINE_CAP_HOURS = 4;
export const BASE_OFFLINE_RATE = 0.5;
export const MIN_OFFLINE_SECONDS = 60;
const PASSIVE_KC_FRACTION = 0.4;

export function offlineCapSeconds(state: GameState, content: Content): number {
  let hours = BASE_OFFLINE_CAP_HOURS;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineCapHours') hours += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return hours * 3600;
}

export function offlineRateFraction(state: GameState, content: Content): number {
  let rate = BASE_OFFLINE_RATE;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineRate') rate += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return Math.min(1, rate);
}

export interface OfflineResult {
  state: GameState;
  elapsedSec: number;
  creditedSec: number;
  souls: Decimal;
  kc: Decimal;
  capped: boolean;
}

export function applyOffline(state: GameState, content: Content, elapsedSec: number, nowMono: number): OfflineResult {
  const zero = new Decimal(0);
  if (!(elapsedSec >= MIN_OFFLINE_SECONDS)) {
    return { state, elapsedSec, creditedSec: 0, souls: zero, kc: zero, capped: false };
  }
  const cap = offlineCapSeconds(state, content);
  const creditedSec = Math.min(elapsedSec, cap);
  const rates = computeRates(state, content, nowMono);
  const souls = rates.soulsPerSec.mul(creditedSec).mul(offlineRateFraction(state, content));
  const kc = souls.mul(PASSIVE_KC_FRACTION);
  return { state: addSouls(state, souls, kc), elapsedSec, creditedSec, souls, kc, capped: elapsedSec > cap };
}
