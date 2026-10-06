import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import { startingDepartments } from './state';
import type { Content } from './content';
import { headStart } from './perks';
import { clampEquipped } from './gacha';
import { clauseSealMult } from './cosmic';

/** Souls-this-run needed to close the books in fiscal year 1; puts the check-in player's first Audit on day 2. */
export const AUDIT_BASE = 8e15;
/** Seals granted for a run that lands exactly on the year-1 threshold. */
export const SEAL_COEFF = 60;
/** Below 0.5 so a run that overshoots by orders of magnitude does not explode the Seal count. */
export const SEAL_EXP = 0.4;
/** The threshold multiplies by this every fiscal year, so each run has to out-earn the last. */
export const YEAR_GROWTH = 1.5;
/**
 * The most Seals one Audit can pay at a Clause multiplier of 1. Without a cap, a run that
 * overshoots its threshold on the back of a long Backlog Report hands out thousands of Seals
 * at once, and since every Seal is +2% global multiplier for good, the next run overshoots
 * further still — the simulator showed the loop collapsing to three-second fiscal years
 * inside a week. The cap keeps the compounding on the perk tree, where the player chooses it,
 * rather than on the payout.
 *
 * The ceiling scales with the Clause Seal multiplier (`sealCap` below): a Clause that promises
 * "Audits pay double" has to mean it, and a flat cap silently cancelled the whole purchase for
 * any run already at the ceiling. The multiplier is bounded at ×3 (×1.5 × ×2) and gated behind
 * Cosmic Restructuring, so the runaway stays shut.
 */
export const SEAL_CAP_PER_AUDIT = 120;

/** The ceiling in force for a given Clause Seal multiplier. */
export function sealCap(sealMult = 1): number {
  return SEAL_CAP_PER_AUDIT * (Number.isFinite(sealMult) && sealMult > 0 ? sealMult : 1);
}

/**
 * From this fiscal year on, the threshold grows polynomially instead of geometrically.
 * Production grows roughly linearly with Seals (+2% each) while a geometric threshold compounds,
 * so every long run used to hit a wall: audits slowed to days of play and Seal income dried up.
 * The minimum fiscal year (below) is what paces the late game now; the taper just keeps the
 * threshold reachable inside it.
 */
export const TAPER_FY = 12;
/**
 * Exponent of the post-taper growth. Perk levels make late income grow roughly with the fiscal
 * year (Seals and levels both accrue per Audit), so 5 outran income and turned deep runs into
 * 8-14 hour waits; 3.6 keeps the check-in player's time-to-audit flat across a Cosmic cycle.
 */
export const TAPER_POWER = 3.6;

/**
 * log10 of the extra Audit threshold after N Cosmic Restructurings (index N; the last entry
 * holds beyond it). Each Restructuring leaves the player with permanent income the fiscal-year
 * curve knows nothing about (Clauses, cards, a faster rebuild), so without this the souls
 * requirement was met in 3-6 seconds of play and the eight-hour clock was the only gate.
 * Fitted with `npx tsx src/sim/year.ts` so a check-in player (five 3-minute sessions a day)
 * meets the threshold about 5 hours into the 8-hour window; re-fit it if income changes.
 */
export const COSMIC_AUDIT_LOG10 = [0, 0.9, 2.6, 2.4, 2.5, 3.1, 2.9, 2.5];
/** The cosmic factor ramps in over this many fiscal years, so the first books after a Restructuring stay quick. */
export const COSMIC_AUDIT_RAMP_FY = 16;

/**
 * AUDIT_BASE × YEAR_GROWTH^(year − 1) up to TAPER_FY, then × (year / TAPER_FY)^TAPER_POWER,
 * then × 10^(COSMIC_AUDIT_LOG10[cosmics] × ramp). With `cosmics` 0 (a new player's first
 * cycle) the factor is 1.
 */
export function auditThreshold(fiscalYear: number, cosmics = 0): Decimal {
  const year = Number.isFinite(fiscalYear) ? Math.max(1, Math.floor(fiscalYear)) : 1;
  const geometric = Math.min(year, TAPER_FY);
  const base = new Decimal(AUDIT_BASE).mul(Decimal.pow(YEAR_GROWTH, geometric - 1));
  const grown = year <= TAPER_FY ? base : base.mul(Decimal.pow(year / TAPER_FY, TAPER_POWER));
  const c = Number.isFinite(cosmics) ? Math.max(0, Math.floor(cosmics)) : 0;
  const log10 = COSMIC_AUDIT_LOG10[Math.min(c, COSMIC_AUDIT_LOG10.length - 1)];
  return log10 === 0 ? grown : grown.mul(Decimal.pow(10, log10 * Math.min(1, (year - 1) / COSMIC_AUDIT_RAMP_FY)));
}

/**
 * A fiscal year lasts at least this long in real time. The Seal loop feeds itself (Seals raise
 * production, production reaches the next threshold sooner), so without a floor the late game
 * collapsed into audits a few seconds apart; the floor makes Seal income predictable, which is
 * what lets the Perk Ledger and Cosmic Restructuring be paced across a year.
 */
export const MIN_FISCAL_YEAR_MS = 8 * 3_600_000;
/** Expediting costs one voucher per started block of this much remaining wait. */
export const EXPEDITE_STEP_MS = 30 * 60_000;

/**
 * Seals for closing a run. Measured against AUDIT_BASE rather than the year's own threshold,
 * so a late fiscal year still pays more for the same effort; the sub-sqrt exponent softens a
 * hugely overshot run and `sealCap(sealMult)` is the hard ceiling above it.
 */
export function sealsForRun(soulsRun: Decimal, fiscalYear: number, sealMult = 1, cosmics = 0): number {
  if (soulsRun.lt(auditThreshold(fiscalYear, cosmics))) return 0;
  const cap = sealCap(sealMult);
  const raw = soulsRun.div(AUDIT_BASE).pow(SEAL_EXP).mul(SEAL_COEFF).mul(sealMult).toNumber();
  if (!Number.isFinite(raw)) return cap;
  return Math.min(cap, Math.floor(raw));
}

/** The souls side of the Audit: this run has filed enough. The clock may still be running. */
export function canAudit(state: { soulsRun: Decimal; fiscalYear: number; stats?: { cosmics: number } }): boolean {
  return state.soulsRun.gte(auditThreshold(state.fiscalYear, state.stats?.cosmics ?? 0));
}

/** Milliseconds until the fiscal year may close; 0 once it is open. */
export function auditTimeLeftMs(state: Pick<GameState, 'runStartWall'>, nowWall: number): number {
  return Math.max(0, state.runStartWall + MIN_FISCAL_YEAR_MS - nowWall);
}

/** Both halves: enough souls and a full fiscal year. */
export function canFileAudit(state: GameState, nowWall: number): boolean {
  return canAudit(state) && auditTimeLeftMs(state, nowWall) === 0;
}

/** Vouchers to close the fiscal year now; 0 when there is nothing left to wait. */
export function expediteCost(state: Pick<GameState, 'runStartWall'>, nowWall: number): number {
  return Math.ceil(auditTimeLeftMs(state, nowWall) / EXPEDITE_STEP_MS);
}

/**
 * Pays vouchers to end the wait. Only offered once the souls are in, so vouchers never buy the
 * threshold itself; hands back the same state when refused.
 */
export function expediteAudit(state: GameState, nowWall: number): GameState {
  const cost = expediteCost(state, nowWall);
  if (cost === 0 || !canAudit(state) || state.vouchers < cost) return state;
  return { ...state, vouchers: state.vouchers - cost, runStartWall: nowWall - MIN_FISCAL_YEAR_MS };
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

export function fileAudit(state: GameState, content: Content, nowWall: number): AuditResult {
  if (!canFileAudit(state, nowWall)) return { state, sealsGained: 0, fiscalYear: state.fiscalYear };
  // Computed here rather than asked of the caller, so every Audit route — store, sim, UI
  // preview — pays the Clause multiplier without having to remember it.
  const sealsGained = sealsForRun(state.soulsRun, state.fiscalYear, clauseSealMult(state, content), state.stats.cosmics);
  const reset = resetRun(state, content);
  const next: GameState = {
    ...reset,
    seals: Math.min(Number.MAX_SAFE_INTEGER, state.seals + sealsGained),
    fiscalYear: state.fiscalYear + 1,
    runStartWall: nowWall,
    stats: { ...state.stats, audits: state.stats.audits + 1 },
  };
  return { state: next, sealsGained, fiscalYear: next.fiscalYear };
}
