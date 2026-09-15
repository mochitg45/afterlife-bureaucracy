import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, PerkDef } from './content';
import { findPerk } from './content';

export function hasPerk(state: GameState, perkId: string): boolean {
  return state.perks.includes(perkId);
}

export type PerkBuyCheck = { ok: true } | { ok: false; reason: 'owned' | 'locked' | 'seals' };

/**
 * Only the two fields the check actually reads, so a React caller can subscribe to those
 * alone instead of re-running on every tick of the whole GameState.
 */
export type PerkWallet = Pick<GameState, 'seals' | 'perks'>;

export function canBuyPerk(state: PerkWallet, content: Content, perkId: string): PerkBuyCheck {
  const perk = findPerk(content, perkId);
  if (state.perks.includes(perkId)) return { ok: false, reason: 'owned' };
  if (!perk.requires.every((r) => state.perks.includes(r))) return { ok: false, reason: 'locked' };
  if (state.seals < perk.cost) return { ok: false, reason: 'seals' };
  return { ok: true };
}

function owned(state: Pick<GameState, 'perks'>, content: Content): PerkDef[] {
  return content.perks.filter((p) => state.perks.includes(p.id));
}

export type AdditivePerkType = 'offlineCapHours' | 'offlineRate' | 'click' | 'voucherMult' | 'equipSlots';

export function perkSum(state: Pick<GameState, 'perks'>, content: Content, type: AdditivePerkType): number {
  let total = 0;
  for (const p of owned(state, content)) {
    if (p.effect.type === type) total += p.effect.value;
  }
  return total;
}

export function perkGlobalMult(state: GameState, content: Content): Decimal {
  let mult = new Decimal(1);
  for (const p of owned(state, content)) {
    if (p.effect.type === 'globalMult') mult = mult.mul(1 + p.effect.value);
  }
  return mult;
}

export function perkDeptMult(state: GameState, content: Content, deptId: string): Decimal {
  let mult = new Decimal(1);
  for (const p of owned(state, content)) {
    if (p.effect.type === 'deptMult' && p.effect.dept === deptId) mult = mult.mul(1 + p.effect.value);
  }
  return mult;
}

export function headStart(state: GameState, content: Content): { depts: string[]; staff: Record<string, number> } {
  const depts: string[] = [];
  const staff: Record<string, number> = {};
  for (const p of owned(state, content)) {
    if (p.effect.type === 'headStartDept') depts.push(p.effect.dept);
    if (p.effect.type === 'headStartStaff') staff[p.effect.staff] = (staff[p.effect.staff] ?? 0) + p.effect.count;
  }
  return { depts, staff };
}
