import Decimal from 'break_infinity.js';
import type { Content } from './content';
import type { GameState } from './state';

/**
 * Field Missions: cards that are not at a desk go out to fetch lost souls for 30 minutes, 2 hours
 * or 8 hours of real time. One trip per length at a time. Every trip pays souls (seconds of
 * current output, capped like postcards), pet treats, and the long one a few vouchers.
 * Pure functions only: the store owns the clock and decides whether it can be trusted.
 */
export interface Mission { slot: number; place: string; cards: string[]; endsWall: number }
export interface MissionsState {
  active: Mission[];
  /** Trips finished per length; moves that length on to the next place. */
  runs: number[];
}

const MIN = 60_000;
export interface MissionSlot { ms: number; team: number; need: number; souls: number; treats: number; vouchers: number }
/** `need` is the team power that earns exactly x1; `souls` is in seconds of output. */
export const MISSION_SLOTS: readonly MissionSlot[] = [
  { ms: 30 * MIN, team: 1, need: 2, souls: 240, treats: 1, vouchers: 0 },
  { ms: 120 * MIN, team: 2, need: 5, souls: 720, treats: 3, vouchers: 0 },
  { ms: 480 * MIN, team: 3, need: 9, souls: 1800, treats: 6, vouchers: 2 },
];
/** One place per founding department; a card from that department counts for more there. */
export const PLACES = ['intake', 'heaven', 'hell', 'reincarnation', 'limbo'] as const;
export const MATCH_BONUS = 1.5;
export const MAX_MISSION_MULT = 2;
export const MISSION_SOUL_CAP = 0.02;
const POWER: Record<string, number> = { temp: 1, fulltime: 2, senior: 3, executive: 4 };

export const initialMissions = (): MissionsState => ({ active: [], runs: MISSION_SLOTS.map(() => 0) });

export function sanitizeMissions(v: unknown): MissionsState {
  const r = (v ?? {}) as { active?: unknown; runs?: unknown };
  const runs = MISSION_SLOTS.map((_, i) => {
    const n = Array.isArray(r.runs) ? Number(r.runs[i]) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  });
  const active: Mission[] = [];
  const used = new Set<string>();
  for (const m of Array.isArray(r.active) ? (r.active as Partial<Mission>[]) : []) {
    const slot = m?.slot as number;
    if (!MISSION_SLOTS[slot] || active.some((a) => a.slot === slot)) continue;
    if (!(PLACES as readonly unknown[]).includes(m.place) || !Number.isFinite(m.endsWall)) continue;
    const cards = [...new Set(Array.isArray(m.cards) ? m.cards : [])].filter((c): c is string => typeof c === 'string' && !used.has(c)).slice(0, MISSION_SLOTS[slot].team);
    if (!cards.length) continue;
    cards.forEach((c) => used.add(c));
    active.push({ slot, place: m.place as string, cards, endsWall: m.endsWall as number });
  }
  return { active, runs };
}

/** Where this length goes next. */
export const missionPlace = (s: Pick<GameState, 'missions'>, slot: number): string => PLACES[(s.missions.runs[slot] + slot * 2) % PLACES.length];
export const missionIn = (s: Pick<GameState, 'missions'>, slot: number): Mission | undefined => s.missions.active.find((m) => m.slot === slot);
export const onMission = (s: Pick<GameState, 'missions'>, cardId: string): boolean => s.missions.active.some((m) => m.cards.includes(cardId));

/** Cards free to travel: owned, kept for good, not at a desk and not already away. */
export function freeCards(s: Pick<GameState, 'cards' | 'equipped' | 'missions'>, content: Content): string[] {
  return content.cards
    .filter((c) => c.id in s.cards && (!c.event || c.rarity === 'executive') && !s.equipped.includes(c.id) && !onMission(s, c.id))
    .map((c) => c.id);
}

export function cardPower(s: Pick<GameState, 'cards'>, content: Content, cardId: string, place: string): number {
  const def = content.cards.find((c) => c.id === cardId);
  if (!def) return 0;
  const stars = Math.max(1, s.cards[cardId] ?? 1);
  return (POWER[def.rarity] ?? 1) * (1 + 0.25 * (stars - 1)) * (def.dept === place ? MATCH_BONUS : 1);
}

/** Reward multiplier for a team: 0.5 for the weakest, 1 at `need`, 2 at most. */
export function missionMult(s: Pick<GameState, 'cards'>, content: Content, slot: number, place: string, cards: readonly string[]): number {
  const power = cards.reduce((n, id) => n + cardPower(s, content, id, place), 0);
  return Math.min(MAX_MISSION_MULT, 0.5 + (0.5 * power) / MISSION_SLOTS[slot].need);
}

/** Sends a team. Refuses (same state) an unknown or busy slot, an empty or oversized team, or a card that cannot travel. */
export function startMission(s: GameState, content: Content, slot: number, cards: readonly string[], wall: number): GameState {
  const def = MISSION_SLOTS[slot];
  if (!def || missionIn(s, slot) || !cards.length || cards.length > def.team || new Set(cards).size !== cards.length) return s;
  const free = freeCards(s, content);
  if (cards.some((c) => !free.includes(c))) return s;
  const m: Mission = { slot, place: missionPlace(s, slot), cards: [...cards], endsWall: wall + def.ms };
  return { ...s, missions: { ...s.missions, active: [...s.missions.active, m] } };
}

/** Brings a team home early, for nothing. */
export function recallMission(s: GameState, slot: number): GameState {
  if (!missionIn(s, slot)) return s;
  return { ...s, missions: { ...s.missions, active: s.missions.active.filter((m) => m.slot !== slot) } };
}

export interface MissionReward { souls: Decimal; treats: number; vouchers: number }

/** Pays out a finished trip; null while it is still running. The caller credits souls and vouchers. */
export function collectMission(s: GameState, content: Content, slot: number, wall: number, soulsPerSec: Decimal): { state: GameState; reward: MissionReward } | null {
  const m = missionIn(s, slot);
  if (!m || wall < m.endsWall) return null;
  const def = MISSION_SLOTS[slot];
  const mult = missionMult(s, content, slot, m.place, m.cards);
  const souls = Decimal.min(soulsPerSec.mul(def.souls * mult), s.soulsLifetime.mul(MISSION_SOUL_CAP));
  const runs = s.missions.runs.map((n, i) => (i === slot ? n + 1 : n));
  return {
    state: { ...s, missions: { active: s.missions.active.filter((x) => x !== m), runs }, pets: { ...s.pets, treats: s.pets.treats + def.treats } },
    reward: { souls, treats: def.treats, vouchers: def.vouchers },
  };
}
