import type { GameState } from './state';
import type { Content } from './content';
import { findDepartment } from './content';
import { canAfford, staffUnitCost, upgradeCost, upgradeLevel, nextMilestone } from './economy';
import { canAudit } from './prestige';
import { isDone } from './dailies';
import { PULL_COST } from './gacha';
import { formatNumber } from './format';

/**
 * Where acting on a goal happens: a control on the Office (by its `data-goal` attribute), or
 * another tab. The UI decides how to get there; the engine only names the place.
 */
export type GoalWhere =
  | { kind: 'office'; selector: string }
  | { kind: 'tab'; tab: 'ledger' | 'personnel' | 'tasks' };

export interface Goal {
  text: string;
  where: GoalWhere | null;
}

/** A locked department counts as "nearly open" once this run has half its souls. */
const NEAR_UNLOCK = 0.5;

/**
 * The single best next action for a player new to idle games, in priority order: the rare,
 * big moves first (an Audit, a finished daily, a draw), then spending Karma in the office
 * (upgrades before staff, since an upgrade is a one-off the staff list would crowd out), then
 * the next department, and stamping as the fallback that is always true.
 */
export function nextGoal(state: GameState, content: Content): Goal {
  if (canAudit(state)) {
    return { text: 'File an Audit in the Ledger for Seals', where: { kind: 'tab', tab: 'ledger' } };
  }
  const claimable = state.dailies.tasks.some((t) => {
    const def = content.dailies.find((d) => d.id === t.id);
    return !!def && !t.claimed && isDone(state, def);
  });
  if (claimable) return { text: 'Claim your daily task', where: { kind: 'tab', tab: 'tasks' } };
  if (state.vouchers >= PULL_COST) {
    return { text: 'Draw a requisition in Personnel', where: { kind: 'tab', tab: 'personnel' } };
  }

  const dept = findDepartment(content, state.activeDept);
  const upgrade = dept.upgrades.find((u) => {
    const level = upgradeLevel(state, u.id);
    return level < u.maxLevel && canAfford(upgradeCost(u, level), state.kc);
  });
  if (upgrade) {
    return { text: `Buy upgrade ${upgrade.name}`, where: { kind: 'office', selector: `[data-goal="upgrade-${upgrade.id}"]` } };
  }

  // Of the clerks one more Karma-worth can hire, the one fewest hires from its next ×2.
  let best: { name: string; id: string; owned: number; left: number } | null = null;
  for (const s of dept.staff) {
    const owned = state.staff[s.id] ?? 0;
    if (!canAfford(staffUnitCost(s, owned), state.kc)) continue;
    const left = nextMilestone(owned) - owned;
    if (!best || left < best.left) best = { name: s.name, id: s.id, owned, left };
  }
  if (best) {
    const where: GoalWhere = { kind: 'office', selector: `[data-goal="staff-${best.id}"]` };
    const text = best.owned === 0 ? `Hire ${best.name}` : `Hire ${best.left} more ${best.name} for ×2 speed`;
    return { text, where };
  }

  const near = content.departments.find(
    (d) =>
      !state.deptsUnlocked.includes(d.id) &&
      (!d.branch || state.branchesUnlocked.includes(d.branch)) &&
      state.soulsRun.gte(d.unlockSouls * NEAR_UNLOCK),
  );
  if (near) {
    return { text: `Reach ${formatNumber(near.unlockSouls)} souls to open ${near.name}`, where: { kind: 'office', selector: `[data-goal="dept-${near.id}"]` } };
  }
  return { text: 'Stamp souls to earn Karma Credits', where: { kind: 'office', selector: '[data-coach="stamp"]' } };
}
