import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, CardDef, Rarity } from './content';
import { nextFloat } from './rng';
import { perkSum } from './perks';
import type { EventOccurrence } from './events';

export const PULL_COST = 10;
export const TEN_PULL_COST = 90;
export const MAX_STARS = 5;
/**
 * Duplicates needed to go ★1→★2, ★2→★3, ★3→★4, ★4→★5, per rarity (index = current stars - 1).
 * Higher rarities need fewer dupes since they're rarer to pull at all.
 */
export const DUPES_PER_STAR: Record<Rarity, number[]> = {
  temp: [2, 4, 8, 16],
  fulltime: [2, 4, 8, 16],
  senior: [1, 3, 6, 12],
  executive: [1, 2, 4, 8],
};

/** Duplicates needed to go from `stars` to `stars + 1` for a card of the given rarity. */
export function dupesForNextStar(rarity: Rarity, stars: number): number {
  return DUPES_PER_STAR[rarity][stars - 1];
}
export const BASE_EQUIP_SLOTS = 3;
export const MAX_EQUIP_SLOTS = 8;
export const PITY_SENIOR = 10;
export const PITY_EXECUTIVE = 60;
export const DUPLICATE_KC_SECONDS = 600;
export const DUPLICATE_KC_MIN = 100;
export const ODDS: Record<Rarity, number> = { temp: 0.7, fulltime: 0.245, senior: 0.05, executive: 0.005 };
const ROLL_ORDER: Rarity[] = ['executive', 'senior', 'fulltime', 'temp'];

/** Spares spent on one Exchange attempt. */
export const EXCHANGE_COST = 3;
/** Chance an Exchange succeeds, by the spent card's own rarity. Executives have no higher rarity to exchange into. */
export const EXCHANGE_CHANCE: Record<'temp' | 'fulltime' | 'senior', number> = { temp: 0.5, fulltime: 0.25, senior: 0.1 };
const NEXT_RARITY: Record<'temp' | 'fulltime' | 'senior', Rarity> = { temp: 'fulltime', fulltime: 'senior', senior: 'executive' };

export interface PullResult {
  cardId: string;
  rarity: Rarity;
  starsAfter: number;
  duplicateKc: Decimal | null;
  pityTriggered: 'senior' | 'executive' | null;
  /** Shards banked toward the next star (0 once ★5 is reached). */
  shards: number;
  /** Shards required for the next star; 0 at ★5. */
  shardsNeeded: number;
  /** True when this duplicate banked a spare copy rather than converting to Karma Credits. */
  spareGained: boolean;
}

/** Outcome of one Exchange attempt (see `exchangeCard`). */
export interface ExchangeResult {
  success: boolean;
  /** The card gained, on success only. */
  cardId: string | null;
  starsAfter: number;
  /** Consolation Karma Credits on failure; also set on a success that maxes an executive. */
  duplicateKc: Decimal | null;
  spareGained: boolean;
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

/** What the normal banner and Exchange can give: event cards come only from their own event. */
const normalCards = (content: Content): CardDef[] => content.cards.filter((c) => !c.event);

function pickCard(seed: number, pool: CardDef[]): { seed: number; card: CardDef } {
  const r = nextFloat(seed);
  return { seed: r.seed, card: pool[Math.min(pool.length - 1, Math.floor(r.value * pool.length))] };
}

export interface PullOptions {
  /** A pull the player was given (a rewarded ad): rolled and counted, but never charged. */
  free?: boolean;
}

/**
 * Applies one copy of `id` to the owned collection: first copy → ★1; below ★5 → bank a shard
 * (star up if that completes the requirement); at ★5 → a spare copy, except an executive card
 * (no higher rarity to exchange into) still converts to Karma Credits. Shared by `pull` and
 * `exchangeCard`, whose "you got a card" step is otherwise identical. Mutates `cards`,
 * `cardShards` and `cardSpares` in place; returns the new `kc` alongside the per-pull result bits.
 */
export function bankCard(
  content: Content,
  cards: Record<string, number>,
  cardShards: Record<string, number>,
  cardSpares: Record<string, number>,
  id: string,
  kc: Decimal,
  kcPerSec: Decimal,
): { kc: Decimal; duplicateKc: Decimal | null; spareGained: boolean; starsAfter: number; shards: number; shardsNeeded: number } {
  const stars = cards[id] ?? 0;
  const def = content.cards.find((c) => c.id === id);
  let duplicateKc: Decimal | null = null;
  let spareGained = false;
  let nextKc = kc;
  if (stars === 0) {
    cards[id] = 1;
  } else if (stars >= MAX_STARS) {
    if (def?.rarity === 'executive') {
      duplicateKc = Decimal.max(new Decimal(DUPLICATE_KC_MIN), kcPerSec.mul(DUPLICATE_KC_SECONDS));
      nextKc = kc.add(duplicateKc);
    } else {
      cardSpares[id] = (cardSpares[id] ?? 0) + 1;
      spareGained = true;
    }
  } else {
    const needed = def ? dupesForNextStar(def.rarity, stars) : DUPES_PER_STAR.temp[stars - 1];
    const shards = (cardShards[id] ?? 0) + 1;
    if (shards >= needed) {
      cards[id] = stars + 1;
      cardShards[id] = 0;
    } else {
      cardShards[id] = shards;
    }
  }
  const starsAfter = cards[id] ?? MAX_STARS;
  return {
    kc: nextKc,
    duplicateKc,
    spareGained,
    starsAfter,
    shards: cardShards[id] ?? 0,
    shardsNeeded: starsAfter >= MAX_STARS ? 0 : def ? dupesForNextStar(def.rarity, starsAfter) : DUPES_PER_STAR.temp[starsAfter - 1],
  };
}

/**
 * The roll loop shared by the normal and event banners: they differ only in which cards a
 * rolled rarity can land on. Pity is one counter across both, so banner-hopping buys nothing.
 */
function pullFrom(
  state: GameState,
  content: Content,
  count: 1 | 10,
  kcPerSec: Decimal,
  cost: number,
  poolFor: (rarity: Rarity) => CardDef[],
): { state: GameState; results: PullResult[] } {
  if (state.vouchers < cost) return { state, results: [] };
  let seed = state.rngSeed;
  let pity = { ...state.pity };
  const cards = { ...state.cards };
  const cardShards = { ...state.cardShards };
  const cardSpares = { ...state.cardSpares };
  let kc = state.kc;
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rollRarity(seed, pity);
    seed = roll.seed;
    const picked = pickCard(seed, poolFor(roll.rarity));
    seed = picked.seed;
    const id = picked.card.id;
    const banked = bankCard(content, cards, cardShards, cardSpares, id, kc, kcPerSec);
    kc = banked.kc;
    const gotSenior = roll.rarity === 'senior' || roll.rarity === 'executive';
    pity = { senior: gotSenior ? 0 : pity.senior + 1, executive: roll.rarity === 'executive' ? 0 : pity.executive + 1 };
    results.push({
      cardId: id,
      rarity: roll.rarity,
      starsAfter: banked.starsAfter,
      duplicateKc: banked.duplicateKc,
      pityTriggered: roll.pityTriggered,
      shards: banked.shards,
      shardsNeeded: banked.shardsNeeded,
      spareGained: banked.spareGained,
    });
  }
  return {
    state: {
      ...state,
      vouchers: state.vouchers - cost,
      rngSeed: seed,
      pity,
      cards,
      cardShards,
      cardSpares,
      kc,
      stats: { ...state.stats, pulls: state.stats.pulls + count },
    },
    results,
  };
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
  const normal = normalCards(content);
  return pullFrom(state, content, count, kcPerSec, cost, (rarity) => {
    const pool = normal.filter((c) => c.rarity === rarity);
    return pool.length ? pool : normal;
  });
}

/**
 * The event banner: the same price, rarity roll and shared pity as `pull`, but a rolled
 * rarity lands on that event's one card of the rarity. Refuses (same state) outside an
 * event with a banner (a special or a weekly theme), or when vouchers are short.
 */
export function pullEvent(
  state: GameState,
  content: Content,
  occ: EventOccurrence,
  count: 1 | 10,
  kcPerSec: Decimal,
): { state: GameState; results: PullResult[] } {
  if (!occ.banner) return { state, results: [] };
  const mine = content.cards.filter((c) => c.event === occ.id);
  if (!mine.length) return { state, results: [] };
  return pullFrom(state, content, count, kcPerSec, count === 10 ? TEN_PULL_COST : PULL_COST, (rarity) => {
    const pool = mine.filter((c) => c.rarity === rarity);
    return pool.length ? pool : mine;
  });
}

/**
 * Spends `EXCHANGE_COST` spare copies of `cardId` for a chance at a random card of the next
 * rarity up, handled exactly like pulling it (new → ★1; owned → shard/star-up; ★5 → spare, or
 * Karma Credits for an executive). On failure, pays the same consolation Karma Credits a
 * duplicate-past-★5 would. Refuses (null result, unchanged state) if the card isn't ★5, doesn't
 * have enough spares, or has no higher rarity to exchange into (executive, or unknown).
 */
export function exchangeCard(
  state: GameState,
  content: Content,
  cardId: string,
  kcPerSec: Decimal,
): { state: GameState; result: ExchangeResult | null } {
  const def = content.cards.find((c) => c.id === cardId);
  const stars = state.cards[cardId] ?? 0;
  const spares = state.cardSpares[cardId] ?? 0;
  if (!def || !(def.rarity in EXCHANGE_CHANCE) || stars < MAX_STARS || spares < EXCHANGE_COST) {
    return { state, result: null };
  }
  const rarity = def.rarity as keyof typeof EXCHANGE_CHANCE;
  const nextRarity = NEXT_RARITY[rarity];
  const cardSpares = { ...state.cardSpares, [cardId]: spares - EXCHANGE_COST };
  const roll = nextFloat(state.rngSeed);
  let seed = roll.seed;
  if (roll.value < EXCHANGE_CHANCE[rarity]) {
    const cards = { ...state.cards };
    const cardShards = { ...state.cardShards };
    const normal = normalCards(content);
    const pool = normal.filter((c) => c.rarity === nextRarity);
    const picked = pickCard(seed, pool.length ? pool : normal);
    seed = picked.seed;
    const banked = bankCard(content, cards, cardShards, cardSpares, picked.card.id, state.kc, kcPerSec);
    return {
      state: { ...state, rngSeed: seed, cards, cardShards, cardSpares, kc: banked.kc },
      result: {
        success: true,
        cardId: picked.card.id,
        starsAfter: banked.starsAfter,
        duplicateKc: banked.duplicateKc,
        spareGained: banked.spareGained,
      },
    };
  }
  const duplicateKc = Decimal.max(new Decimal(DUPLICATE_KC_MIN), kcPerSec.mul(DUPLICATE_KC_SECONDS));
  return {
    state: { ...state, rngSeed: seed, cardSpares, kc: state.kc.add(duplicateKc) },
    result: { success: false, cardId: null, starsAfter: 0, duplicateKc, spareGained: false },
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
  // Event cards never take a lanyard: every one you own works during its event (see cardEventMult).
  if (content.cards.find((c) => c.id === cardId)?.event) return state;
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

function sumEffect(state: GameState, content: Content, type: 'clickMult' | 'offlineCapHours' | 'voucherMult' | 'eventMult'): number {
  let t = 0;
  for (const { def, stars } of equippedDefs(state, content)) {
    if (def.effect.type === type) t += def.effect.value * stars;
  }
  return t;
}

export const cardClickMult = (s: GameState, c: Content): number => sumEffect(s, c, 'clickMult');
export const cardOfflineCapHours = (s: GameState, c: Content): number => sumEffect(s, c, 'offlineCapHours');
export const cardVoucherMult = (s: GameState, c: Content): number => sumEffect(s, c, 'voucherMult');
/** Equipped regular cards, plus every owned event card: those are all on duty during their event. */
export const cardEventMult = (s: GameState, c: Content): number => {
  let t = 0;
  for (const def of c.cards) {
    if (!def.event || !(def.id in s.cards) || def.effect.type !== 'eventMult') continue;
    t += def.effect.value * s.cards[def.id];
  }
  return t + sumEffect({ ...s, equipped: s.equipped.filter((id) => !c.cards.find((d) => d.id === id)?.event) }, c, 'eventMult');
};
