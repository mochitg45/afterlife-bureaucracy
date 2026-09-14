import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import { startingDepartments } from './state';
import type { Content } from './content';
import { headStart } from './perks';

export const AUDIT_THRESHOLD = 500_000_000_000;

export function sealsForRun(soulsRun: Decimal): number {
  if (soulsRun.lt(AUDIT_THRESHOLD)) return 0;
  const n = soulsRun.div(AUDIT_THRESHOLD).sqrt().toNumber();
  return Number.isFinite(n) ? Math.floor(n) : Number.MAX_SAFE_INTEGER;
}

export function canAudit(state: GameState): boolean {
  return state.soulsRun.gte(AUDIT_THRESHOLD);
}

export interface AuditResult { state: GameState; sealsGained: number; fiscalYear: number }

export function fileAudit(state: GameState, content: Content): AuditResult {
  if (!canAudit(state)) return { state, sealsGained: 0, fiscalYear: state.fiscalYear };
  const sealsGained = sealsForRun(state.soulsRun);
  const start = headStart(state, content);
  const unlocked = new Set([...startingDepartments(content), ...start.depts]);
  const deptsUnlocked = content.departments.filter((d) => unlocked.has(d.id)).map((d) => d.id);
  const next: GameState = {
    ...state,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    staff: { ...start.staff },
    upgrades: {},
    deptsUnlocked,
    activeDept: deptsUnlocked[0],
    seals: state.seals + sealsGained,
    fiscalYear: state.fiscalYear + 1,
    stats: { ...state.stats, audits: state.stats.audits + 1 },
  };
  return { state: next, sealsGained, fiscalYear: next.fiscalYear };
}
