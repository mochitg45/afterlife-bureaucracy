import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { computeRates, upgradeLevel, PASSIVE_KC_FRACTION } from './economy';
import { addSouls } from './actions';
import { perkSum } from './perks';
import { cardOfflineCapHours } from './gacha';
import { clauseOfflineCapHours } from './cosmic';
import { offlineEarningsMult } from './entitlements';
import { activeEvent, eventOccurrences, eventRate } from './events';

export const BASE_OFFLINE_CAP_HOURS = 4;
export const BASE_OFFLINE_RATE = 0.5;
export const MIN_OFFLINE_SECONDS = 60;

export function offlineCapSeconds(state: GameState, content: Content): number {
  let hours = BASE_OFFLINE_CAP_HOURS;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineCapHours') hours += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  hours += perkSum(state, content, 'offlineCapHours');
  hours += cardOfflineCapHours(state, content);
  hours += clauseOfflineCapHours(state, content);
  return hours * 3600;
}

export function offlineRateFraction(state: GameState, content: Content): number {
  let rate = BASE_OFFLINE_RATE;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineRate') rate += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  rate += perkSum(state, content, 'offlineRate');
  return Math.min(1, rate);
}

export interface OfflineResult {
  state: GameState;
  elapsedSec: number;
  creditedSec: number;
  souls: Decimal;
  kc: Decimal;
  /** Event currency credited for the part of the gap inside the event window. */
  eventPoints: Decimal;
  capped: boolean;
}

/**
 * The credited seconds start where the player left (`nowWall - elapsedSec`), so only their
 * overlap with the event's window counts: an event that ended mid-gap pays up to endWall, and
 * one that began mid-gap pays from startWall. The occurrence is found by the saved key, since
 * by the time the app reopens the running event may already be a different one.
 */
function applyOfflineEvent(
  state: GameState,
  content: Content,
  elapsedSec: number,
  creditedSec: number,
  nowWall: number,
  forceEvent?: string | null,
): { state: GameState; points: Decimal } {
  const ev = state.event;
  const none = { state, points: new Decimal(0) };
  if (!ev) return none;
  const leftWall = nowWall - elapsedSec * 1000;
  const occ = [activeEvent(content, nowWall, forceEvent), ...eventOccurrences(content, leftWall, nowWall)].find((o) => o?.key === ev.key);
  if (!occ) return none;
  const from = Math.max(leftWall, occ.startWall);
  const to = Math.min(leftWall + creditedSec * 1000, occ.endWall);
  if (!(to > from)) return none;
  const points = eventRate(state, content, occ).mul((to - from) / 1000).mul(offlineRateFraction(state, content));
  return { state: { ...state, event: { ...ev, points: ev.points.add(points), earned: ev.earned.add(points) } }, points };
}

export function applyOffline(state: GameState, content: Content, elapsedSec: number, nowWall: number, forceEvent?: string | null): OfflineResult {
  const zero = new Decimal(0);
  if (!(elapsedSec >= MIN_OFFLINE_SECONDS)) {
    return { state, elapsedSec, creditedSec: 0, souls: zero, kc: zero, eventPoints: zero, capped: false };
  }
  const cap = offlineCapSeconds(state, content);
  const creditedSec = Math.min(elapsedSec, cap);
  const rates = computeRates(state, content, nowWall);
  // Remove-Ads pays double on the Backlog Report; the cap and the half rate are unchanged.
  const souls = rates.soulsPerSec.mul(creditedSec).mul(offlineRateFraction(state, content)).mul(offlineEarningsMult(state));
  const kc = souls.mul(PASSIVE_KC_FRACTION);
  const earned = addSouls(state, souls, kc);
  const { state: next, points } = applyOfflineEvent(earned, content, elapsedSec, creditedSec, nowWall, forceEvent);
  return { state: next, elapsedSec, creditedSec, souls, kc, eventPoints: points, capped: elapsedSec > cap };
}
