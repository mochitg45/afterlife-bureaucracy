import Decimal from 'break_infinity.js';
import type { GameState, Stats } from './state';
import type { Content, AchievementDef, AchievementCondition, StoryTrigger } from './content';
import { grantVouchers } from './vouchers';

export function isMet(state: GameState, content: Content, cond: AchievementCondition | StoryTrigger): boolean {
  switch (cond.type) {
    case 'soulsLifetime':
      return state.soulsLifetime.gte(cond.target);
    case 'staffOwned':
      return (state.staff[cond.staff] ?? 0) >= cond.target;
    case 'cardsOwned':
      return Object.keys(state.cards).length >= cond.target;
    case 'executivesOwned':
      return content.cards.filter((c) => c.rarity === 'executive' && c.id in state.cards).length >= cond.target;
    case 'fiveStarCards':
      return Object.values(state.cards).filter((s) => s >= 5).length >= cond.target;
    case 'perksOwned':
      return state.perks.length >= cond.target;
    case 'departmentsUnlocked':
      return state.deptsUnlocked.length >= cond.target;
    case 'equipped':
      return state.equipped.length >= cond.target;
    case 'bestStreak':
      return state.dailies.bestStreak >= cond.target;
    case 'seals':
      return state.seals >= cond.target;
    case 'fiscalYear':
      return state.fiscalYear >= cond.target;
    default:
      return state.stats[cond.type as keyof Stats] >= cond.target;
  }
}

export function checkAchievements(state: GameState, content: Content): { state: GameState; unlocked: AchievementDef[] } {
  const unlocked = content.achievements.filter((a) => !state.achievements.includes(a.id) && isMet(state, content, a.condition));
  if (unlocked.length === 0) return { state, unlocked };
  let next: GameState = { ...state, achievements: [...state.achievements, ...unlocked.map((a) => a.id)] };
  for (const a of unlocked) if (a.vouchers) next = grantVouchers(next, content, a.vouchers);
  return { state: next, unlocked };
}

export function achievementMult(state: GameState): Decimal {
  return new Decimal(1 + 0.01 * state.achievements.length);
}
