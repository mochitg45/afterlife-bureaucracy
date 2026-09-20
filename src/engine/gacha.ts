import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, CardDef, Rarity } from './content';
import { nextFloat } from './rng';
import { perkSum } from './perks';

export const PULL_COST = 10;
export const TEN_PULL_COST = 90;
export const MAX_STARS = 5;
export const BASE_EQUIP_SLOTS = 3;
export const MAX_EQUIP_SLOTS = 8;
export const PITY_SENIOR = 10;
export const PITY_EXECUTIVE = 60;
export const DUPLICATE_KC_SECONDS = 600;
export const DUPLICATE_KC_MIN = 100;
export const ODDS: Record<Rarity, number> = { temp: 0.7, fulltime: 0.245, senior: 0.05, executive: 0.005 };
const ROLL_ORDER: Rarity[] = ['executive', 'senior', 'fulltime', 'temp'];

export interface PullResult {
  cardId: string;
  rarity: Rarity;
  starsAfter: number;
  duplicateKc: Decimal | null;
  pityTriggered: 'senior' | 'executive' | null;
}

/** Rolls a rarity from a seed, applying pity: forced senior+ at PITY_SENIOR, forced executive at PITY_EXECUTIVE. */
export function rollRarity(
  seed: number,
  pity: { senior: number; executive: number },
): { seed: number; rarity: Rarity; pityTriggered: PullResult['pityTriggered'] } {
  const r = nextFloat(seed);
  let acc = 0;
  let natural: Rarity = 'temp';
  for (const rarity of ROLL_ORDER) {
    acc += ODDS[rarity];
    if (r.value < acc) {
      natural = rarity;
      break;
    }
  }
  if (pity.executive >= PITY_EXECUTIVE - 1) {
    return { seed: r.seed, rarity: 'executive', pityTriggered: natural === 'executive' ? null : 'executive' };
  }
  if (pity.senior >= PITY_SENIOR - 1 && natural !== 'executive' && natural !== 'senior') {
    return { seed: r.seed, rarity: 'senior', pityTriggered: 'senior' };
  }
  return { seed: r.seed, rarity: natural, pityTriggered: null };
}

function pickCard(seed: number, pool: CardDef[]): { seed: number; card: CardDef } {
  const r = nextFloat(seed);
  return { seed: r.seed, card: pool[Math.min(pool.length - 1, Math.floor(r.value * pool.length))] };
}

export interface PullOptions {
  /** A pull the player was given (a rewarded ad): rolled and counted, but never charged. */
  free?: boolean;
}

/** Spends vouchers, rolls `count` cards from a seeded RNG, and applies duplicate-to-KC conversion past 5 stars. Refuses (same state) if vouchers are short. */
export function pull(
  state: GameState,
  content: Content,
  count: 1 | 10,
  kcPerSec: Decimal,
  opts: PullOptions = {},
): { state: GameState; results: PullResult[] } {
  const cost = opts.free ? 0 : count === 10 ? TEN_PULL_COST : PULL_COST;
  if (state.vouchers < cost) return { state, results: [] };
  let seed = state.rngSeed;
  let pity = { ...state.pity };
  const cards = { ...state.cards };
  let kc = state.kc;
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rollRarity(seed, pity);
    seed = roll.seed;
    const pool = content.cards.filter((c) => c.rarity === roll.rarity);
    const picked = pickCard(seed, pool.length ? pool : content.cards);
    seed = picked.seed;
    const id = picked.card.id;
    const stars = cards[id] ?? 0;
    let duplicateKc: Decimal | null = null;
    if (stars >= MAX_STARS) {
      duplicateKc = Decimal.max(new Decimal(DUPLICATE_KC_MIN), kcPerSec.mul(DUPLICATE_KC_SECONDS));
      kc = kc.add(duplicateKc);
    } else {
      cards[id] = stars + 1;
    }
    const gotSenior = roll.rarity === 'senior' || roll.rarity === 'executive';
    pity = { senior: gotSenior ? 0 : pity.senior + 1, executive: roll.rarity === 'executive' ? 0 : pity.executive + 1 };
    results.push({ cardId: id, rarity: roll.rarity, starsAfter: cards[id] ?? MAX_STARS, duplicateKc, pityTriggered: roll.pityTriggered });
  }
  return {
    state: { ...state, vouchers: state.vouchers - cost, rngSeed: seed, pity, cards, kc, stats: { ...state.stats, pulls: state.stats.pulls + count } },
    results,
  };
}

/** Only `perks` is read, so a React caller can subscribe to that alone rather than the whole state. */
export function equipSlots(state: Pick<GameState, 'perks'>, content: Content): number {
  return Math.min(MAX_EQUIP_SLOTS, BASE_EQUIP_SLOTS + perkSum(state, content, 'equipSlots'));
}

/**
 * Trims `equipped` to the slots the state can actually hold. Losing a slot-granting perk
 * (Cosmic Restructuring) or rolling back to a build with fewer slots would otherwise leave
 * cards equipped past the last lanyard, quietly paying out multipliers the player cannot see.
 */
export function clampEquipped(state: GameState, content: Content): GameState {
  const slots = equipSlots(state, content);
  if (state.equipped.length <= slots) return state;
  return { ...state, equipped: state.equipped.slice(0, slots) };
}

/** Equips an owned card into a free slot. Refuses (same state) if not owned, already equipped, or no free slot. */
export function equipCard(state: GameState, content: Content, cardId: string): GameState {
  if (!(cardId in state.cards) || state.equipped.includes(cardId)) return state;
  if (state.equipped.length >= equipSlots(state, content)) return state;
  return { ...state, equipped: [...state.equipped, cardId], stats: { ...state.stats, equips: state.stats.equips + 1 } };
}

export function unequipCard(state: GameState, cardId: string): GameState {
  if (!state.equipped.includes(cardId)) return state;
  return { ...state, equipped: state.equipped.filter((id) => id !== cardId) };
}

/** Non-throwing lookup (mirrors perks.ts's `owned()`): a stale/unknown equipped id is silently skipped rather than crashing computeRates. */
function equippedDefs(state: GameState, content: Content): Array<{ def: CardDef; stars: number }> {
  return content.cards.filter((def) => state.equipped.includes(def.id)).map((def) => ({ def, stars: state.cards[def.id] ?? 1 }));
}

export function cardGlobalMult(state: GameState, content: Content): Decimal {
  let m = new Decimal(1);
  for (const { def, stars } of equippedDefs(state, content)) {
    if (def.effect.type === 'globalMult') m = m.mul(1 + def.effect.value * stars);
  }
  return m;
}

export function cardDeptMult(state: GameState, content: Content, deptId: string): Decimal {
  let m = new Decimal(1);
  for (const { def, stars } of equippedDefs(state, content)) {
    if (def.effect.type === 'deptMult' && def.effect.dept === deptId) m = m.mul(1 + def.effect.value * stars);
  }
  return m;
}

function sumEffect(state: GameState, content: Content, type: 'clickMult' | 'offlineCapHours' | 'voucherMult'): number {
  let t = 0;
  for (const { def, stars } of equippedDefs(state, content)) {
    if (def.effect.type === type) t += def.effect.value * stars;
  }
  return t;
}

export const cardClickMult = (s: GameState, c: Content): number => sumEffect(s, c, 'clickMult');
export const cardOfflineCapHours = (s: GameState, c: Content): number => sumEffect(s, c, 'offlineCapHours');
export const cardVoucherMult = (s: GameState, c: Content): number => sumEffect(s, c, 'voucherMult');
