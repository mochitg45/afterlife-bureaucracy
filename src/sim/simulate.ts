import Decimal from 'break_infinity.js';
import type { Content } from '../engine/content';
import { createInitialState, type GameState } from '../engine/state';
import { tick, click, buyStaff, buyUpgrade, buyPerk, addSouls, unlockDepartments } from '../engine/actions';
import {
  computeRates, staffBulkCost, upgradeCost, upgradeLevel,
  BOOST_AD_DURATION_MS, BOOST_AD_COOLDOWN_MS,
} from '../engine/economy';
import { applyOffline } from '../engine/offline';
import { canAudit, fileAudit } from '../engine/prestige';
import { canBuyPerk, headStart } from '../engine/perks';
import { rollover, claimDaily, skipDailyFree, isDone, dayKey } from '../engine/dailies';
import { pull, equipCard, unequipCard, equipSlots, TEN_PULL_COST, PULL_COST } from '../engine/gacha';
import { canCosmic, fileCosmic, buyClause, canBuyClause, clauseSealMult } from '../engine/cosmic';
import { checkAchievements } from '../engine/achievements';
import { checkStory } from '../engine/story';

/**
 * The synthetic local wall clock the first session starts on: 5 January 2026, 09:00. The
 * time of day matters — five sessions of three minutes advance the clock by exactly 24 h, so
 * starting mid-morning puts precisely one local midnight, and therefore one daily rollover,
 * inside every simulated day.
 */
export const SIM_EPOCH = new Date(2026, 0, 5, 9).getTime();

export interface SimOptions {
  sessionsPerDay: number;
  sessionSec: number;
  clicksPerSec: number;
  days: number;
  startSeals?: number;
  startPerks?: string[];
  /** Synthetic local wall clock the first session starts at; advanced by played and gap seconds. */
  startWallMs?: number;
}

export interface DaySnapshot {
  day: number;
  soulsRun: string;
  kc: string;
  deptsUnlocked: string[];
  seals: number;
  fiscalYear: number;
  audits: number;
  vouchers: number;
  /** Vouchers the day granted (balance delta plus whatever was spent on pulls that day). */
  vouchersEarned: number;
  /** Of those, the recurring faucet: daily-task rewards plus the seven-day streak pack. */
  vouchersFromTasks: number;
  /** Of those, the one-off Achievement unlock grants. */
  vouchersFromAchievements: number;
  /** Requisitions drawn today, free ad pull included — the effective pull count. */
  pullsToday: number;
  /** Of those, the ones the daily `free-pull` ad paid for. */
  freePullsToday: number;
  /** Rewarded ads watched today across all four placements. */
  adsToday: number;
  cards: number;
  equipped: number;
  achievements: number;
  cosmicPoints: number;
  clauses: number;
  dailiesClaimed: number;
}

export interface SimResult {
  days: DaySnapshot[];
  firstUnlockSec: Record<string, number>;
  firstUnlockYear: Record<string, number>;
  firstAuditReadyDay: number | null;
  firstAuditReadySec: number | null;
  /** Played seconds from each run's start until that run first met its Audit threshold. */
  auditReadySecByRun: number[];
  /** Seals paid out by each Audit, in order. */
  sealsPerAudit: number[];
  /** The Clause Seal multiplier in force at each Audit, in the same order — the cap scales with it. */
  sealMultPerAudit: number[];
  /** Sim day each Cosmic Restructuring was filed on. */
  cosmicDays: number[];
  firstCosmicDay: number | null;
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

/**
 * Wear the strongest cards the collection can field: score every owned card by
 * `effect.value × stars` and hold the top `equipSlots` of them, dropping anything a newer
 * pull has outclassed.
 */
function equipBest(state: GameState, content: Content): GameState {
  const slots = equipSlots(state, content);
  const wanted = content.cards
    .filter((c) => c.id in state.cards)
    .map((c) => ({ id: c.id, score: c.effect.value * (state.cards[c.id] ?? 1) }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, slots)
    .map((c) => c.id);
  for (const id of [...state.equipped]) if (!wanted.includes(id)) state = unequipCard(state, id);
  for (const id of wanted) if (!state.equipped.includes(id)) state = equipCard(state, content, id);
  return state;
}

/** One pull per session: the ten-pull whenever the wallet covers it, otherwise a single. */
function spendVouchers(state: GameState, content: Content, kcPerSec: Decimal): GameState {
  if (state.vouchers >= TEN_PULL_COST) return pull(state, content, 10, kcPerSec).state;
  if (state.vouchers >= PULL_COST) return pull(state, content, 1, kcPerSec).state;
  return state;
}

/**
 * The `overtime-boost` placement: ×2 output for four hours, watched at the top of every
 * session the eight-hour cooldown has cleared. Mirrors the store's own grant exactly, so the
 * simulated player never gets a boost a real one could not have.
 */
function watchBoost(state: GameState, wallMs: number): GameState {
  if (wallMs < state.adState.boostCooldownUntilWall) return state;
  return {
    ...state,
    boostUntilWall: wallMs + BOOST_AD_DURATION_MS,
    adState: { ...state.adState, boostCooldownUntilWall: wallMs + BOOST_AD_COOLDOWN_MS },
    stats: { ...state.stats, adsWatched: state.stats.adsWatched + 1 },
  };
}

/**
 * The `free-pull` placement: one ad-funded single requisition per local day. It costs no
 * voucher but counts as a pull, so it feeds the "draw a requisition" daily the same way a
 * paid one does.
 */
function watchFreePull(state: GameState, content: Content, kcPerSec: Decimal, today: string): GameState {
  if (state.adState.freePullDate === today) return state;
  const drawn = pull(state, content, 1, kcPerSec, { free: true }).state;
  return {
    ...drawn,
    adState: { ...drawn.adState, freePullDate: today },
    stats: { ...drawn.stats, adsWatched: drawn.stats.adsWatched + 1 },
  };
}

/**
 * The `daily-skip` placement: once a day, on the last session, write off one task the day
 * never finished and claim it. An ad-skipped task is claimable — the skip is an instant
 * completion, not a forfeit (spec §8) — so this is real faucet income, and it is the reason
 * the free player's voucher count does not depend on drawing three reachable tasks.
 */
function watchDailySkip(
  state: GameState,
  content: Content,
  kcPerSec: Decimal,
  today: string,
): { state: GameState; vouchers: number } {
  if (state.adState.dailySkipDate === today) return { state, vouchers: 0 };
  const target = state.dailies.tasks.find((t) => {
    const def = content.dailies.find((d) => d.id === t.id);
    return !!def && !t.claimed && !isDone(state, def);
  });
  if (!target) return { state, vouchers: 0 };
  const skipped = skipDailyFree(state, content, target.id);
  if (skipped === state) return { state, vouchers: 0 };
  const marked: GameState = {
    ...skipped,
    adState: { ...skipped.adState, dailySkipDate: today },
    stats: { ...skipped.stats, adsWatched: skipped.stats.adsWatched + 1 },
  };
  const claim = claimDaily(marked, content, target.id, kcPerSec);
  return { state: claim.state, vouchers: claim.vouchers };
}

/** Claim every daily the session has finished; reports the vouchers those claims paid. */
function claimDone(state: GameState, content: Content, kcPerSec: Decimal): { state: GameState; vouchers: number } {
  let vouchers = 0;
  for (const task of [...state.dailies.tasks]) {
    const def = content.dailies.find((d) => d.id === task.id);
    if (!def || task.claimed || !isDone(state, def)) continue;
    const claim = claimDaily(state, content, task.id, kcPerSec);
    state = claim.state;
    vouchers += claim.vouchers;
  }
  return { state, vouchers };
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
  const sealsPerAudit: number[] = [];
  const sealMultPerAudit: number[] = [];
  const cosmicDays: number[] = [];
  let runStartSec = 0;
  let runReady = false;
  let played = 0;
  let wallMs = opts.startWallMs ?? SIM_EPOCH;
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
    const vouchersAtDayStart = state.vouchers;
    const pullsAtDayStart = state.stats.pulls;
    const adsAtDayStart = state.stats.adsWatched;
    let vouchersSpentToday = 0;
    let tasksToday = 0;
    let achievementsToday = 0;
    let freePullsToday = 0;
    for (let s = 0; s < opts.sessionsPerDay; s++) {
      // Returning from the gap since the last session: the Backlog Report, doubled by the one
      // rewarded `offline-double` ad this session is assumed to watch.
      if (played > 0) {
        wallMs += gapSec * 1000;
        const off = applyOffline(state, content, gapSec, wallMs);
        state = unlockDepartments(addSouls(off.state, off.souls, off.kc), content);
        state = { ...state, stats: { ...state.stats, adsWatched: state.stats.adsWatched + 1 } };
        state = buyGreedy(state, content);
        note(day);
      }
      // `overtime-boost`: taken at the top of every session, subject to the same eight-hour
      // cooldown the store enforces — on a five-session day that is roughly every other one.
      state = watchBoost(state, wallMs);
      // Ads are assumed ready, so the `ad` daily is drawable and finishable every day.
      state = rollover(state, content, wallMs, { unionActive: false, adsReady: true });
      for (let t = 0; t < opts.sessionSec; t++) {
        for (let c = 0; c < opts.clicksPerSec; c++) state = click(state, content, wallMs);
        state = tick(state, content, 1, wallMs);
        state = buyGreedy(state, content);
        played += 1;
        wallMs += 1000;
        note(day);
      }
      // End of session: the engine holds no rates, so stamp the rate the "reach N souls per
      // second" daily is measured against, exactly as the store's settle() does.
      const rates = computeRates(state, content, wallMs);
      state = { ...state, dailies: { ...state.dailies, soulsPerSecSnapshot: rates.soulsPerSec.toString() } };
      // File the Audit as soon as it is available, spend the Seals on the cheapest affordable
      // perks, and restructure once the Bureau will hear it.
      if (canAudit(state)) {
        // Read before the filing: fileAudit pays the multiplier the run held, and Cosmic
        // Clauses survive an Audit, so this is also the multiplier the cap scales by.
        sealMultPerAudit.push(clauseSealMult(state, content));
        const audit = fileAudit(state, content);
        state = audit.state;
        sealsPerAudit.push(audit.sealsGained);
        state = buyGreedyPerks(state, content);
        runStartSec = played;
        runReady = false;
        note(day);
      }
      if (canCosmic(state)) {
        state = fileCosmic(state, content).state;
        cosmicDays.push(day);
        // Every Clause costs the same single Cosmic Point, so "cheapest affordable" is just
        // the first one the prerequisites allow, in content order.
        const clause = content.clauses.find((c) => canBuyClause(state, content, c.id).ok);
        if (clause) state = buyClause(state, content, clause.id);
        runStartSec = played;
        runReady = false;
        note(day);
      }
      // An Audit or a Cosmic Restructuring has just wiped the staff and upgrades, so the rate
      // stamped above belongs to an office that no longer exists. Daily-task KC and duplicate
      // conversions are both priced off it, and paying them at the pre-reset rate handed the
      // fresh run a fortune it had not earned. Re-read it from the state that exists now.
      const payRates = computeRates(state, content, wallMs);
      const today = dayKey(wallMs);
      // `free-pull`: one ad-funded single requisition per local day.
      const beforeFree = state.stats.pulls;
      state = watchFreePull(state, content, payRates.kcPerSec, today);
      freePullsToday += state.stats.pulls - beforeFree;
      const beforePull = state.vouchers;
      state = spendVouchers(state, content, payRates.kcPerSec);
      vouchersSpentToday += Math.max(0, beforePull - state.vouchers);
      state = equipBest(state, content);
      const claimed = claimDone(state, content, payRates.kcPerSec);
      state = claimed.state;
      tasksToday += claimed.vouchers;
      // `daily-skip`: on the last session of the day, one task the day never finished is
      // written off with an ad and then claimed.
      if (s === opts.sessionsPerDay - 1) {
        const skip = watchDailySkip(state, content, payRates.kcPerSec, today);
        state = skip.state;
        tasksToday += skip.vouchers;
      }
      const beforeAch = state.vouchers;
      state = checkAchievements(state, content).state;
      achievementsToday += state.vouchers - beforeAch;
      state = checkStory(state, content).state;
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
      vouchers: state.vouchers,
      vouchersEarned: state.vouchers - vouchersAtDayStart + vouchersSpentToday,
      vouchersFromTasks: tasksToday,
      vouchersFromAchievements: achievementsToday,
      pullsToday: state.stats.pulls - pullsAtDayStart,
      freePullsToday,
      adsToday: state.stats.adsWatched - adsAtDayStart,
      cards: Object.keys(state.cards).length,
      equipped: state.equipped.length,
      achievements: state.achievements.length,
      cosmicPoints: state.cosmicPoints,
      clauses: state.cosmicClauses.length,
      dailiesClaimed: state.stats.dailiesClaimed,
    });
  }
  return {
    days,
    firstUnlockSec,
    firstUnlockYear,
    firstAuditReadyDay,
    firstAuditReadySec,
    auditReadySecByRun,
    sealsPerAudit,
    sealMultPerAudit,
    cosmicDays,
    firstCosmicDay: cosmicDays.length ? cosmicDays[0] : null,
    secondsPlayed: played,
  };
}

type VoucherSource = 'all' | 'tasks' | 'achievements';
const FIELD: Record<VoucherSource, keyof DaySnapshot> = {
  all: 'vouchersEarned',
  tasks: 'vouchersFromTasks',
  achievements: 'vouchersFromAchievements',
};

/**
 * Mean vouchers granted per day over an inclusive day range (1-based, as the tables read).
 * `tasks` is the recurring faucet a free player can count on every day — the three daily
 * tasks and the seven-day streak pack — which is what the pacing target is stated against;
 * `achievements` is the separate one-off unlock budget, front-loaded by design.
 */
export function vouchersPerDay(r: SimResult, fromDay: number, toDay: number, source: VoucherSource = 'all'): number {
  const slice = r.days.filter((d) => d.day >= fromDay && d.day <= toDay);
  if (!slice.length) return 0;
  return slice.reduce((t, d) => t + (d[FIELD[source]] as number), 0) / slice.length;
}

/** The largest Seal payout of any Audit the run filed. */
export function maxSealsPerAudit(r: SimResult): number {
  return r.sealsPerAudit.reduce((m, s) => Math.max(m, s), 0);
}
