import Decimal from 'break_infinity.js';
import type { Content } from '../engine/content';
import { createInitialState, type GameState } from '../engine/state';
import { tick, click, buyStaff, buyUpgrade, buyPerk } from '../engine/actions';
import { staffBulkCost, upgradeCost, upgradeLevel } from '../engine/economy';
import { applyOffline } from '../engine/offline';
import { canAudit, fileAudit } from '../engine/prestige';
import { canBuyPerk, headStart } from '../engine/perks';

export interface SimOptions { sessionsPerDay: number; sessionSec: number; clicksPerSec: number; days: number; startSeals?: number; startPerks?: string[] }
export interface DaySnapshot { day: number; soulsRun: string; kc: string; deptsUnlocked: string[]; seals: number; fiscalYear: number; audits: number }
export interface SimResult {
  days: DaySnapshot[];
  firstUnlockSec: Record<string, number>;
  firstUnlockYear: Record<string, number>;
  firstAuditReadyDay: number | null;
  firstAuditReadySec: number | null;
  /** Played seconds from each run's start until that run first met its Audit threshold. */
  auditReadySecByRun: number[];
  secondsPlayed: number;
}

function buyGreedy(state: GameState, content: Content): GameState {
  for (;;) {
    let best: { kind: 'staff' | 'upgrade'; id: string } | null = null;
    let bestCost: Decimal | null = null;
    for (const d of content.departments) {
      if (!state.deptsUnlocked.includes(d.id)) continue;
      for (const s of d.staff) {
        // Match buyStaff's own cost formula exactly (staffBulkCost with count=1) rather than
        // staffUnitCost: the two formulas can differ by float epsilon at an exact-affordability
        // boundary, which made this pre-check say "affordable" while buyStaff then refused the
        // purchase — an infinite loop, since nothing about the state ever changed.
        const c = staffBulkCost(s, state.staff[s.id] ?? 0, 1);
        if (c.lte(state.kc) && (!bestCost || c.lt(bestCost))) { bestCost = c; best = { kind: 'staff', id: s.id }; }
      }
      for (const u of d.upgrades) {
        const lvl = upgradeLevel(state, u.id);
        if (lvl >= u.maxLevel) continue;
        const c = upgradeCost(u, lvl);
        if (c.lte(state.kc) && (!bestCost || c.lt(bestCost))) { bestCost = c; best = { kind: 'upgrade', id: u.id }; }
      }
    }
    if (!best) return state;
    state = best.kind === 'staff' ? buyStaff(state, content, best.id, 1) : buyUpgrade(state, content, best.id);
  }
}

/** Greedily buy the cheapest affordable perk (by Seal cost) until none remain affordable. */
function buyGreedyPerks(state: GameState, content: Content): GameState {
  for (;;) {
    let best: string | null = null;
    let bestCost = Infinity;
    for (const p of content.perks) {
      if (p.cost < bestCost && canBuyPerk(state, content, p.id).ok) { bestCost = p.cost; best = p.id; }
    }
    if (!best) return state;
    state = buyPerk(state, content, best);
  }
}

export function simulate(opts: SimOptions, content: Content): SimResult {
  let state: GameState = { ...createInitialState({ wall: 0, mono: 0 }, content), seals: opts.startSeals ?? 0, perks: [...(opts.startPerks ?? [])] };
  // A "seeded" run represents a player who already owns these Perk Ledger nodes going into a
  // fresh fiscal year — apply the same Head Start bonus fileAudit() would grant, so
  // headstart-N perks actually pre-unlock departments/staff here instead of being inert.
  {
    const start = headStart(state, content);
    state = { ...state, staff: { ...start.staff }, deptsUnlocked: [...new Set([...state.deptsUnlocked, ...start.depts])] };
  }
  const firstUnlockSec: Record<string, number> = {};
  const firstUnlockYear: Record<string, number> = {};
  let firstAuditReadyDay: number | null = null;
  let firstAuditReadySec: number | null = null;
  const auditReadySecByRun: number[] = [];
  let runStartSec = 0;
  let runReady = false;
  let played = 0;
  const days: DaySnapshot[] = [];
  const gapSec = (86_400 - opts.sessionsPerDay * opts.sessionSec) / opts.sessionsPerDay;
  const note = (day: number) => {
    for (const id of state.deptsUnlocked) {
      if (!(id in firstUnlockSec) && id !== 'intake') {
        firstUnlockSec[id] = played;
        firstUnlockYear[id] = state.fiscalYear;
      }
    }
    if (!runReady && canAudit(state)) {
      runReady = true;
      auditReadySecByRun.push(played - runStartSec);
      if (firstAuditReadyDay === null) { firstAuditReadyDay = day; firstAuditReadySec = played; }
    }
  };
  for (let day = 1; day <= opts.days; day++) {
    for (let s = 0; s < opts.sessionsPerDay; s++) {
      for (let t = 0; t < opts.sessionSec; t++) {
        for (let c = 0; c < opts.clicksPerSec; c++) state = click(state, content, 0);
        state = tick(state, content, 1, 0);
        state = buyGreedy(state, content);
        played += 1;
        note(day);
      }
      // End of session: file the Audit as soon as it's available, then spend Seals greedily
      // on the cheapest affordable perk, before the offline gap to the next session.
      if (canAudit(state)) {
        state = fileAudit(state, content).state;
        state = buyGreedyPerks(state, content);
        runStartSec = played;
        runReady = false;
        note(day);
      }
      state = applyOffline(state, content, gapSec, 0).state;
      state = buyGreedy(state, content);
      note(day);
    }
    days.push({
      day,
      soulsRun: state.soulsRun.toString(),
      kc: state.kc.toString(),
      deptsUnlocked: [...state.deptsUnlocked],
      seals: state.seals,
      fiscalYear: state.fiscalYear,
      audits: state.stats.audits,
    });
  }
  return { days, firstUnlockSec, firstUnlockYear, firstAuditReadyDay, firstAuditReadySec, auditReadySecByRun, secondsPlayed: played };
}
