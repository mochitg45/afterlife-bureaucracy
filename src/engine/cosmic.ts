import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { ClauseDef, Content } from './content';
import { findClause } from './content';
import { resetRun } from './prestige';

/** Seals needed before the Bureau will entertain a first Cosmic Restructuring. */
export const COSMIC_THRESHOLD = 100;
/**
 * What each further filing multiplies the requirement by. A flat 100 Seals was a one-off gate
 * that turned into a treadmill: once the Perk Ledger and the Seal cap were doing their work, a
 * late run banked a hundred Seals in a couple of days and the simulator filed eight
 * Restructurings inside the first month, which is neither ceremonious nor paced. Growth keeps
 * the first filing where it was and pushes each next one a real distance further out.
 */
export const COSMIC_THRESHOLD_GROWTH = 1.5;
/** Every Clause costs the same: one Cosmic Point. The tree is gated by prerequisites, not price. */
export const CLAUSE_COST = 1;

/**
 * Seals the next Cosmic Restructuring asks for, after `cosmics` of them have been filed:
 * 100, 150, 225, 338, 506, … Every reader — the engine, the store, the Ledger's Cosmic panel
 * and the ceremony — goes through this, so the number on screen is always the one the filing
 * will actually check.
 */
export function cosmicThreshold(cosmics: number): number {
  const filed = Number.isFinite(cosmics) ? Math.max(0, Math.floor(cosmics)) : 0;
  return Math.round(COSMIC_THRESHOLD * Math.pow(COSMIC_THRESHOLD_GROWTH, filed));
}

/** Only the fields the check reads, so a React caller can subscribe to those alone. */
export type CosmicWallet = Pick<GameState, 'seals'> & { stats: Pick<GameState['stats'], 'cosmics'> };

export function canCosmic(state: CosmicWallet): boolean {
  return state.seals >= cosmicThreshold(state.stats.cosmics);
}

export interface CosmicResult { state: GameState; pointsGained: number }

/**
 * The second prestige tier: hand back every Seal and Perk the player has accumulated for one
 * Cosmic Point. The fiscal year survives — Cosmic restructures the staff, not the calendar —
 * and so do lifetime souls, vouchers, cards, Clauses and unlocked branches.
 *
 * Perks are cleared *before* resetRun so the Head Start it grants is computed from the perk
 * set the player is left with, and resetRun's own clampEquipped then trims any lanyard the
 * lost slot-granting perks were paying for.
 */
export function fileCosmic(state: GameState, content: Content): CosmicResult {
  if (!canCosmic(state)) return { state, pointsGained: 0 };
  const reset = resetRun({ ...state, seals: 0, perks: [] }, content);
  return {
    state: {
      ...reset,
      cosmicPoints: state.cosmicPoints + 1,
      stats: { ...state.stats, cosmics: state.stats.cosmics + 1 },
    },
    pointsGained: 1,
  };
}

export type ClauseBuyCheck = { ok: true } | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'points' };

/** Only the two fields the check reads; mirrors perks.ts's PerkWallet. */
export type ClauseWallet = Pick<GameState, 'cosmicPoints' | 'cosmicClauses'>;

export function canBuyClause(state: ClauseWallet, content: Content, clauseId: string): ClauseBuyCheck {
  const clause = findClause(content, clauseId);
  if (!clause) return { ok: false, reason: 'unknown' };
  if (state.cosmicClauses.includes(clauseId)) return { ok: false, reason: 'owned' };
  if (!clause.requires.every((r) => state.cosmicClauses.includes(r))) return { ok: false, reason: 'locked' };
  if (state.cosmicPoints < CLAUSE_COST) return { ok: false, reason: 'points' };
  return { ok: true };
}

/** Buys a Clause, or hands back the same state when the purchase is refused. */
export function buyClause(state: GameState, content: Content, clauseId: string): GameState {
  const clause = findClause(content, clauseId);
  if (!clause || !canBuyClause(state, content, clauseId).ok) return state;
  const next: GameState = {
    ...state,
    cosmicPoints: state.cosmicPoints - CLAUSE_COST,
    cosmicClauses: [...state.cosmicClauses, clauseId],
  };
  if (clause.effect.type === 'unlockBranch' && !next.branchesUnlocked.includes(clause.effect.branch)) {
    next.branchesUnlocked = [...next.branchesUnlocked, clause.effect.branch];
  }
  return next;
}

/** Only the owned-clause list; every multiplier below reads nothing else. */
export type ClauseHolder = Pick<GameState, 'cosmicClauses'>;

/** Non-throwing lookup: a Clause id from a newer build is silently ignored, not a crash. */
function owned(state: ClauseHolder, content: Content): ClauseDef[] {
  return content.clauses.filter((c) => state.cosmicClauses.includes(c.id));
}

/** Compounding: each throughput Clause multiplies by (1 + value), like the perk tree. */
export function clauseGlobalMult(state: ClauseHolder, content: Content): Decimal {
  let mult = new Decimal(1);
  for (const c of owned(state, content)) {
    if (c.effect.type === 'globalMult') mult = mult.mul(1 + c.effect.value);
  }
  return mult;
}

/** Outright multipliers (x1.5, x2), not bonuses: the Clause text promises the factor itself. */
export function clauseSealMult(state: ClauseHolder, content: Content): number {
  let mult = 1;
  for (const c of owned(state, content)) {
    if (c.effect.type === 'sealMult') mult *= c.effect.value;
  }
  return mult;
}

export function clauseOfflineCapHours(state: ClauseHolder, content: Content): number {
  let hours = 0;
  for (const c of owned(state, content)) {
    if (c.effect.type === 'offlineCapHours') hours += c.effect.value;
  }
  return hours;
}

/** A factor applied on top of the perk/card voucher multiplier, not another term inside it. */
export function clauseVoucherMult(state: ClauseHolder, content: Content): number {
  let mult = 1;
  for (const c of owned(state, content)) {
    if (c.effect.type === 'voucherMult') mult *= 1 + c.effect.value;
  }
  return mult;
}
