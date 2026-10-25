import type { Content, SetDef } from './content';
import type { GameState } from './state';

/** Hard ceiling on any one kind of set bonus, however many sets are added later. */
export const SET_BONUS_CAP = 0.3;

type Owned = Pick<GameState, 'cards'>;

/** How many of the set's cards are owned (any stars). */
export function setProgress(state: Owned, set: SetDef): { have: number; total: number } {
  return { have: set.cards.filter((id) => id in state.cards).length, total: set.cards.length };
}

export function isSetComplete(state: Owned, set: SetDef): boolean {
  const p = setProgress(state, set);
  return p.have === p.total;
}

export function completedSets(state: Owned, content: Content): SetDef[] {
  return content.sets.filter((s) => isSetComplete(state, s));
}

/**
 * Multiplier from completed sets for one kind of bonus, ≥ 1. `souls` applies to every department
 * when the set names none, or only to the named one. Office-only: events, vouchers and seals never read this.
 */
export function setBonusMult(state: Owned, content: Content, type: SetDef['bonus']['type'], dept?: string): number {
  let t = 0;
  for (const s of completedSets(state, content)) {
    if (s.bonus.type !== type) continue;
    if (type === 'souls' && s.bonus.dept && s.bonus.dept !== dept) continue;
    t += s.bonus.value;
  }
  return 1 + Math.min(t, SET_BONUS_CAP);
}
