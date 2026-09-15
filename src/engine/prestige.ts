import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import { startingDepartments } from './state';
import type { Content } from './content';
import { headStart } from './perks';
import { clampEquipped } from './gacha';

/** Souls-this-run needed to close the books in fiscal year 1; puts the first Audit on day 2. */
export const AUDIT_BASE = 5.2e11;
/** Seals granted for a run that lands exactly on the year-1 threshold. */
export const SEAL_COEFF = 12;
/** Below 0.5 so a run that overshoots by orders of magnitude does not explode the Seal count. */
export const SEAL_EXP = 0.4;
/** The threshold multiplies by this every fiscal year, so each run has to out-earn the last. */
export const YEAR_GROWTH = 2.5;

/** The Audit threshold for a given fiscal year: AUDIT_BASE × YEAR_GROWTH^(year − 1). */
export function auditThreshold(fiscalYear: number): Decimal {
  const year = Number.isFinite(fiscalYear) ? Math.max(1, Math.floor(fiscalYear)) : 1;
  return new Decimal(AUDIT_BASE).mul(Decimal.pow(YEAR_GROWTH, year - 1));
}

/**
 * Seals for closing a run. Measured against AUDIT_BASE rather than the year's own threshold,
 * so a late fiscal year still pays more for the same effort; the sub-sqrt exponent keeps a
 * hugely overshot run from handing out a lifetime of Seals at once.
 */
export function sealsForRun(soulsRun: Decimal, fiscalYear: number): number {
  if (soulsRun.lt(auditThreshold(fiscalYear))) return 0;
  const raw = soulsRun.div(AUDIT_BASE).pow(SEAL_EXP).mul(SEAL_COEFF).toNumber();
  if (!Number.isFinite(raw)) return Number.MAX_SAFE_INTEGER;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(raw));
}

export function canAudit(state: { soulsRun: Decimal; fiscalYear: number }): boolean {
  return state.soulsRun.gte(auditThreshold(state.fiscalYear));
}

/**
 * The shared "fresh fiscal year" reset: everything a run owns goes, everything meta stays.
 * Cosmic Restructuring must clear `perks` on the state *before* calling this, or the head
 * start it grants would be computed from perks the player is about to lose — and because
 * clearing them can also take slot-granting perks away, this ends with clampEquipped so the
 * player is never left wearing more lanyards than the new perk set pays for.
 */
export function resetRun(state: GameState, content: Content): GameState {
  const start = headStart(state, content);
  const unlocked = new Set([...startingDepartments(content), ...start.depts]);
  const deptsUnlocked = content.departments.filter((d) => unlocked.has(d.id)).map((d) => d.id);
  return clampEquipped(
    {
      ...state,
      kc: new Decimal(0),
      soulsRun: new Decimal(0),
      staff: { ...start.staff },
      upgrades: {},
      deptsUnlocked,
      activeDept: deptsUnlocked[0],
    },
    content,
  );
}

export interface AuditResult { state: GameState; sealsGained: number; fiscalYear: number }

export function fileAudit(state: GameState, content: Content): AuditResult {
  if (!canAudit(state)) return { state, sealsGained: 0, fiscalYear: state.fiscalYear };
  const sealsGained = sealsForRun(state.soulsRun, state.fiscalYear);
  const reset = resetRun(state, content);
  const next: GameState = {
    ...reset,
    seals: Math.min(Number.MAX_SAFE_INTEGER, state.seals + sealsGained),
    fiscalYear: state.fiscalYear + 1,
    stats: { ...state.stats, audits: state.stats.audits + 1 },
  };
  return { state: next, sealsGained, fiscalYear: next.fiscalYear };
}
