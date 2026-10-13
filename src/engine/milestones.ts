import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import { startingDepartments } from './state';
import type { Content } from './content';

export type Milestone = { kind: 'souls'; tier: number } | { kind: 'dept'; id: string };
export type MilestoneRecord = GameState['milestones'];

/** 0 below one million; 2 = million, 3 = billion, 4 = trillion, then every x1000. */
export function soulsTier(souls: Decimal): number {
  if (souls.lt(1e6)) return 0;
  return Math.floor(souls.log10() / 3 + 1e-9);
}

/**
 * What to celebrate now, plus the record to store. An existing player's first look is a silent
 * baseline (everything already passed counts as celebrated); brand-new players have nothing to
 * baseline. Starting departments never celebrate.
 */
export function nextMilestones(
  s: Pick<GameState, 'soulsLifetime' | 'deptsUnlocked' | 'milestones' | 'stats'>,
  content: Content,
): { queue: Milestone[]; next: MilestoneRecord } {
  const m = s.milestones;
  const tier = soulsTier(s.soulsLifetime);
  const starting = new Set(startingDepartments(content));
  const baselined = m.depts.length > 0 || m.soulsTier > 0;
  if (!baselined && (s.stats.clicks > 0 || s.soulsLifetime.gt(0))) {
    return { queue: [], next: { soulsTier: tier, depts: [...s.deptsUnlocked] } };
  }
  const queue: Milestone[] = [];
  for (let t = Math.max(m.soulsTier + 1, 2); t <= tier; t++) queue.push({ kind: 'souls', tier: t });
  const seen = new Set(m.depts);
  const fresh = s.deptsUnlocked.filter((id) => !seen.has(id) && !starting.has(id));
  fresh.forEach((id) => queue.push({ kind: 'dept', id }));
  if (!queue.length) return { queue, next: m };
  return { queue, next: { soulsTier: Math.max(m.soulsTier, tier), depts: [...new Set([...m.depts, ...s.deptsUnlocked])] } };
}
