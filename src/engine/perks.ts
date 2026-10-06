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
export type PerkWallet = Pick<GameState, 'seals' | 'perks'> & { perkLevels?: Record<string, number> };

export function canBuyPerk(state: PerkWallet, content: Content, perkId: string): PerkBuyCheck {
  const perk = findPerk(content, perkId);
  if (state.perks.includes(perkId)) return { ok: false, reason: 'owned' };
  if (!perk.requires.every((r) => state.perks.includes(r))) return { ok: false, reason: 'locked' };
  if (state.seals < perk.cost) return { ok: false, reason: 'seals' };
  return { ok: true };
}

/** What the effect maths read: ownership plus the (optional, sparse) level map. */
type PerkOwnership = Pick<GameState, 'perks'> & { perkLevels?: Record<string, number> };

/** Highest level an upgradable perk can reach (owning it is level 1). */
export const MAX_PERK_LEVEL = 10;
/** Each level above 1 adds this fraction of the perk's base effect. */
export const LEVEL_STEP = 0.25;
/** Upgrade from level L to L+1 costs perk.cost x UPGRADE_GROWTH^(L-1). */
export const UPGRADE_GROWTH = 2;

/** Slots and Head Start grants are discrete, so only the numeric effects take levels. */
export function perkUpgradable(perk: PerkDef): boolean {
  const t = perk.effect.type;
  return t !== 'equipSlots' && t !== 'headStartDept' && t !== 'headStartStaff';
}

/** 0 when not owned, else 1..MAX_PERK_LEVEL. Missing map entries mean level 1. */
export function perkLevel(state: PerkOwnership, perkId: string): number {
  if (!state.perks.includes(perkId)) return 0;
  const lvl = Math.floor(state.perkLevels?.[perkId] ?? 1);
  return Math.min(MAX_PERK_LEVEL, Math.max(1, Number.isFinite(lvl) ? lvl : 1));
}

/** Multiplier on the perk's base effect value at a level: 1, 1.25, 1.5 ... 3.25. */
export function levelScale(level: number): number {
  return 1 + LEVEL_STEP * (Math.max(1, level) - 1);
}

/** The effect value a perk delivers at a level (0 for effects without a numeric value). */
export function perkValueAt(perk: PerkDef, level: number): number {
  const e = perk.effect;
  return 'value' in e ? e.value * levelScale(level) : 0;
}

/** Seals to take an owned perk from `level` to `level + 1`. */
export function upgradeCost(perk: PerkDef, level: number): number {
  return Math.ceil(perk.cost * Math.pow(UPGRADE_GROWTH, Math.max(1, level) - 1));
}

export type PerkUpgradeCheck = { ok: true } | { ok: false; reason: 'unowned' | 'fixed' | 'max' | 'seals' };

export function canUpgradePerk(state: PerkWallet, content: Content, perkId: string): PerkUpgradeCheck {
  const perk = findPerk(content, perkId);
  const level = perkLevel(state, perkId);
  if (level === 0) return { ok: false, reason: 'unowned' };
  if (!perkUpgradable(perk)) return { ok: false, reason: 'fixed' };
  if (level >= MAX_PERK_LEVEL) return { ok: false, reason: 'max' };
  if (state.seals < upgradeCost(perk, level)) return { ok: false, reason: 'seals' };
  return { ok: true };
}

/** Spends Seals to raise a perk one level; hands back the same state when refused. */
export function upgradePerk(state: GameState, content: Content, perkId: string): GameState {
  if (!canUpgradePerk(state, content, perkId).ok) return state;
  const level = perkLevel(state, perkId);
  const cost = upgradeCost(findPerk(content, perkId), level);
  return {
    ...state,
    seals: state.seals - cost,
    sealsInvested: state.sealsInvested + cost,
    perkLevels: { ...state.perkLevels, [perkId]: level + 1 },
  };
}

function owned(state: PerkOwnership, content: Content): Array<{ p: PerkDef; value: number }> {
  return content.perks
    .filter((p) => state.perks.includes(p.id))
    .map((p) => ({ p, value: perkValueAt(p, perkUpgradable(p) ? perkLevel(state, p.id) : 1) }));
}

export type AdditivePerkType = 'offlineCapHours' | 'offlineRate' | 'click' | 'voucherMult' | 'equipSlots';

export function perkSum(state: PerkOwnership, content: Content, type: AdditivePerkType): number {
  let total = 0;
  for (const { p, value } of owned(state, content)) {
    if (p.effect.type === type) total += value;
  }
  return total;
}

export function perkGlobalMult(state: GameState, content: Content): Decimal {
  let mult = new Decimal(1);
  for (const { p, value } of owned(state, content)) {
    if (p.effect.type === 'globalMult') mult = mult.mul(1 + value);
  }
  return mult;
}

export function perkDeptMult(state: GameState, content: Content, deptId: string): Decimal {
  let mult = new Decimal(1);
  for (const { p, value } of owned(state, content)) {
    if (p.effect.type === 'deptMult' && p.effect.dept === deptId) mult = mult.mul(1 + value);
  }
  return mult;
}

export function headStart(state: GameState, content: Content): { depts: string[]; staff: Record<string, number> } {
  const depts: string[] = [];
  const staff: Record<string, number> = {};
  for (const { p } of owned(state, content)) {
    if (p.effect.type === 'headStartDept') depts.push(p.effect.dept);
    if (p.effect.type === 'headStartStaff') staff[p.effect.staff] = (staff[p.effect.staff] ?? 0) + p.effect.count;
  }
  return { depts, staff };
}
