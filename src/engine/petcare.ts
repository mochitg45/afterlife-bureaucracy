import type { GameState } from './state';
import { FREE_PET, grantPremium, ownsPremium, petOnDuty, premiumDef } from './premium';

/**
 * Pet Care: feed, brush and walk any pet you own, each on its own 6-hour timer. Care earns XP, a
 * level adds +1% souls while that pet is on duty, up to level 10. Feeding eats a treat; walking
 * finds one, so care never depends on missions.
 */
export type CareKind = 'feed' | 'brush' | 'walk';
export const CARE_KINDS: readonly CareKind[] = ['feed', 'brush', 'walk'];
export interface PetCare { xp: number; feed: number; brush: number; walk: number }
export interface PetsState {
  treats: number;
  /** Per pet: XP, and the wall-clock ms each kind of care was last given (0 = never). */
  care: Record<string, PetCare>;
}

export const CARE_MS = 6 * 3_600_000;
export const CARE_XP: Record<CareKind, number> = { feed: 10, brush: 5, walk: 5 };
export const MAX_PET_LEVEL = 10;
export const PET_LEVEL_BONUS = 0.01;
/** XP from level n to n+1 is 20 x n: the first level-up takes one round of care, the last nine. */
const XP_STEP = 20;

export const initialPets = (): PetsState => ({ treats: 2, care: {} });
const noCare = (): PetCare => ({ xp: 0, feed: 0, brush: 0, walk: 0 });

export function sanitizePets(v: unknown): PetsState {
  const r = (v && typeof v === 'object' ? v : {}) as { treats?: unknown; care?: unknown };
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
  const care: PetsState['care'] = {};
  for (const [id, c] of Object.entries((r.care && typeof r.care === 'object' ? r.care : {}) as Record<string, Partial<PetCare>>)) {
    if (premiumDef(id)?.slot !== 'pet') continue;
    care[id] = { xp: Math.floor(n(c?.xp)), feed: n(c?.feed), brush: n(c?.brush), walk: n(c?.walk) };
  }
  return { treats: r.treats === undefined ? initialPets().treats : Math.floor(n(r.treats)), care };
}

type Holder = Pick<GameState, 'pets'>;
export const petCare = (s: Holder, id: string): PetCare => s.pets.care[id] ?? noCare();

/** Level and progress into it. */
export function petLevel(s: Holder, id: string): { level: number; xp: number; need: number } {
  let xp = petCare(s, id).xp;
  let level = 1;
  while (level < MAX_PET_LEVEL && xp >= XP_STEP * level) xp -= XP_STEP * level++;
  return { level, xp, need: level < MAX_PET_LEVEL ? XP_STEP * level : 0 };
}

/** The on-duty pet's care bonus; 1 with no pet on duty. */
export function petCareMult(s: Pick<GameState, 'pets' | 'entitlements'>): number {
  const pet = petOnDuty(s);
  return pet ? 1 + PET_LEVEL_BONUS * (petLevel(s, pet.id).level - 1) : 1;
}

/** Ms until this care can be given again; 0 when ready. A clock set back never waits longer than one full timer. */
export const careWait = (s: Holder, id: string, kind: CareKind, wall: number): number =>
  Math.min(CARE_MS, Math.max(0, petCare(s, id)[kind] + CARE_MS - wall));

export const canCare = (s: Pick<GameState, 'pets' | 'entitlements'>, id: string, kind: CareKind, wall: number): boolean =>
  ownsPremium(s, id) && premiumDef(id)?.slot === 'pet' && careWait(s, id, kind, wall) === 0 && (kind !== 'feed' || s.pets.treats > 0);

/** Refuses (same state) when the pet is not owned, the timer is running, or there is no treat to feed. */
export function givePetCare(s: GameState, id: string, kind: CareKind, wall: number): GameState {
  if (!canCare(s, id, kind, wall)) return s;
  const c = petCare(s, id);
  const treats = s.pets.treats + (kind === 'feed' ? -1 : kind === 'walk' ? 1 : 0);
  return { ...s, pets: { treats, care: { ...s.pets.care, [id]: { ...c, xp: c.xp + CARE_XP[kind], [kind]: wall } } } };
}

export const adopted = (s: Pick<GameState, 'entitlements'>): boolean => ownsPremium(s, FREE_PET.id);
/** The free pet everyone can have. Goes straight on duty if the pet slot has never been filled. */
export const adoptPet = (s: GameState): GameState => grantPremium(s, [FREE_PET.id]);
