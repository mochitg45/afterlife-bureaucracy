import type { CardDef, Content } from './content';
import type { GameState } from './state';

/**
 * Desk Planner: equipped cards sit on a 4x2 floor plan and affect their neighbours (left/right and
 * front/back). A card that is not seated neither gives nor takes anything, so a player who never
 * opens the planner is unaffected.
 */
export const DESK_COLS = 4;
export const DESK_COUNT = 8;
export type PairKind = 'team' | 'mentor' | 'rival';
export const PAIR_BONUS: Record<PairKind, number> = { team: 0.03, mentor: 0.04, rival: -0.02 };
export const DESK_CAP = 0.25;
export const DESK_FLOOR = -0.1;

export const initialSeats = (): string[] => Array<string>(DESK_COUNT).fill('');

export function sanitizeSeats(v: unknown): string[] {
  const seen = new Set<string>();
  return initialSeats().map((_, i) => {
    const id = Array.isArray(v) ? v[i] : '';
    if (typeof id !== 'string' || !id || seen.has(id)) return '';
    seen.add(id);
    return id;
  });
}

type Seated = Pick<GameState, 'seats' | 'equipped'>;
/** Who really sits where: a card that was unequipped leaves its desk empty. */
export const deskSeats = (s: Seated): string[] => s.seats.map((id) => (s.equipped.includes(id) ? id : ''));

/** One effect per pair, strongest story first: rivals, then mentor, then teammates. */
export function pairKind(a: CardDef, b: CardDef): PairKind | null {
  const depts = [a.dept, b.dept];
  if (depts.includes('heaven') && depts.includes('hell')) return 'rival';
  const rarities = [a.rarity, b.rarity];
  if (rarities.includes('executive') && rarities.includes('temp')) return 'mentor';
  return a.dept === b.dept ? 'team' : null;
}

/** Every neighbouring pair of desks, each once. */
export const DESK_PAIRS: readonly [number, number][] = Array.from({ length: DESK_COUNT }, (_, i) => i).flatMap((i) => {
  const out: [number, number][] = [];
  if (i % DESK_COLS < DESK_COLS - 1) out.push([i, i + 1]);
  if (i + DESK_COLS < DESK_COUNT) out.push([i, i + DESK_COLS]);
  return out;
});

export interface DeskPair { a: number; b: number; kind: PairKind }
export function deskPairs(s: Seated, content: Content): DeskPair[] {
  const defs = deskSeats(s).map((id) => (id ? content.cards.find((c) => c.id === id) : undefined));
  return DESK_PAIRS.flatMap(([a, b]) => {
    const x = defs[a], y = defs[b];
    const kind = x && y ? pairKind(x, y) : null;
    return kind ? [{ a, b, kind }] : [];
  });
}

export function deskBonus(s: Seated, content: Content): number {
  const sum = deskPairs(s, content).reduce((n, p) => n + PAIR_BONUS[p.kind], 0);
  return Math.min(DESK_CAP, Math.max(DESK_FLOOR, sum));
}
export const deskMult = (s: Seated, content: Content): number => 1 + deskBonus(s, content);

/** Seats an equipped card at `desk`, swapping with whoever is there; a null desk stands it up. */
export function seatCard<S extends Seated>(s: S, cardId: string, desk: number | null): S {
  if (!s.equipped.includes(cardId)) return s;
  if (desk !== null && !(Number.isInteger(desk) && desk >= 0 && desk < DESK_COUNT)) return s;
  const seats = deskSeats(s);
  const from = seats.indexOf(cardId);
  if (from === (desk ?? -1)) return s;
  if (from >= 0) seats[from] = desk === null ? '' : seats[desk];
  if (desk !== null) seats[desk] = cardId;
  return { ...s, seats };
}
