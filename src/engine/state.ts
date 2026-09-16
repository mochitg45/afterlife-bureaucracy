import Decimal from 'break_infinity.js';
import { migrate, SAVE_VERSION } from './migrations';
import { clampEquipped } from './gacha';
import type { Content } from './content';

export { SAVE_VERSION };

export interface Stats {
  clicks: number;
  staffHired: number;
  upgradesBought: number;
  audits: number;
  pulls: number;
  equips: number;
  dailiesClaimed: number;
  adsWatched: number;
  perksBought: number;
  cosmics: number;
  purchases: number;
}

/** Things the player owns for good (or until a subscription lapses), never reset by a run. */
export interface Entitlements {
  removeAds: boolean;
  /** Wall-clock ms-epoch the Union Membership runs to; 0 when not subscribed. */
  unionUntilWall: number;
  starterPackBought: boolean;
}

/** Per-day and per-cooldown bookkeeping for the rewarded-ad placements. */
export interface AdState {
  /** Local day key the free single pull was taken on. */
  freePullDate: string;
  /** Local day key the daily-skip reward was taken on. */
  dailySkipDate: string;
  /** Wall-clock ms-epoch before which the Overtime Boost ad is unavailable. */
  boostCooldownUntilWall: number;
}

export interface DailyTaskState { id: string; claimed: boolean }

export interface DailyBaseline {
  clicks: number;
  staffHired: number;
  upgradesBought: number;
  equips: number;
  audits: number;
  perksBought: number;
  pulls: number;
  /** Rewarded ads watched before today, so the "watch an ad" daily measures today's alone. */
  adsWatched: number;
}

export interface DailiesState {
  date: string;
  tasks: DailyTaskState[];
  skipped: string[];
  streak: number;
  bestStreak: number;
  skipTokens: number;
  lastTokenDate: string;
  baseline: DailyBaseline;
  completedToday: boolean;
  /**
   * The engine holds no rates, so the store stamps the current souls/sec here on every
   * settle; the "reach N souls per second" daily reads it. A Decimal string, not a number.
   */
  soulsPerSecSnapshot: string;
}

export interface Settings {
  notifOptIn: 'unasked' | 'yes' | 'no';
  /** Local day key the notification budget below is counted against. */
  notifDate: string;
  /** Notifications already scheduled today, so a chatty app cannot spam the tray. */
  notifsSent: number;
}

export interface GameState {
  saveVersion: number;
  kc: Decimal;
  soulsRun: Decimal;
  soulsLifetime: Decimal;
  seals: number;
  vouchers: number;
  /** Carried remainder of a fractional voucher grant, 0 <= f < 1. Keeps the faucet honest. */
  voucherFraction: number;
  perks: string[];
  staff: Record<string, number>;
  upgrades: Record<string, number>;
  deptsUnlocked: string[];
  activeDept: string;
  fiscalYear: number;
  /** Wall-clock ms-epoch deadline for the Overtime Boost; 0 when no boost is running. */
  boostUntilWall: number;
  lastSeenWallClock: number;
  uptimeAtSave: number;
  stats: Stats;
  /** Owned personnel cards, keyed by card id, valued at star rank 1-5. */
  cards: Record<string, number>;
  equipped: string[];
  pity: { senior: number; executive: number };
  rngSeed: number;
  dailies: DailiesState;
  achievements: string[];
  storySeen: string[];
  settings: Settings;
  firstSeenWallClock: number;
  entitlements: Entitlements;
  adState: AdState;
  cosmicPoints: number;
  cosmicClauses: string[];
  branchesUnlocked: string[];
  /** The process that last wrote this save; see engine/integrity.ts. */
  processId: string;
}

export interface Now { wall: number; mono: number }

/**
 * Departments that cost nothing to open are unlocked from the first day on the job. A branch
 * department never counts, whatever its threshold: it exists only once a Cosmic Clause has
 * opened its branch.
 */
export function startingDepartments(content: Content): string[] {
  return content.departments.filter((d) => d.unlockSouls === 0 && !d.branch).map((d) => d.id);
}

export function createInitialState(now: Now, content: Content): GameState {
  const deptsUnlocked = startingDepartments(content);
  return {
    saveVersion: SAVE_VERSION,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    soulsLifetime: new Decimal(0),
    seals: 0,
    vouchers: 0,
    voucherFraction: 0,
    perks: [],
    staff: {},
    upgrades: {},
    deptsUnlocked,
    activeDept: deptsUnlocked[0],
    fiscalYear: 1,
    boostUntilWall: 0,
    lastSeenWallClock: now.wall,
    uptimeAtSave: now.mono,
    stats: { clicks: 0, staffHired: 0, upgradesBought: 0, audits: 0, pulls: 0, equips: 0, dailiesClaimed: 0, adsWatched: 0, perksBought: 0, cosmics: 0, purchases: 0 },
    cards: {},
    equipped: [],
    pity: { senior: 0, executive: 0 },
    rngSeed: (now.wall % 2147483647) || 1,
    dailies: {
      date: '',
      tasks: [],
      skipped: [],
      streak: 0,
      bestStreak: 0,
      skipTokens: 0,
      lastTokenDate: '',
      baseline: { clicks: 0, staffHired: 0, upgradesBought: 0, equips: 0, audits: 0, perksBought: 0, pulls: 0, adsWatched: 0 },
      completedToday: false,
      soulsPerSecSnapshot: '0',
    },
    achievements: [],
    storySeen: [],
    settings: { notifOptIn: 'unasked', notifDate: '', notifsSent: 0 },
    firstSeenWallClock: now.wall,
    entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false },
    adState: { freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 },
    cosmicPoints: 0,
    cosmicClauses: [],
    branchesUnlocked: [],
    processId: '',
  };
}

const DECIMAL_FIELDS = ['kc', 'soulsRun', 'soulsLifetime'] as const;

export function serialize(state: GameState): string {
  const raw: Record<string, unknown> = { ...state };
  for (const f of DECIMAL_FIELDS) raw[f] = state[f].toString();
  return JSON.stringify(raw);
}

/** Numbers written by an older build (or a hand-edited save) may arrive as numeric strings. */
function num(v: unknown, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** A garbled Decimal must never take the whole save down with it. */
function dec(v: unknown): Decimal {
  try {
    const d = new Decimal(String(v ?? '0'));
    return Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) ? d : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

/** Owned-count maps: coerce to numbers, drop anything non-finite or negative. */
function counts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    const n = num(raw, -1);
    if (n >= 0) out[key] = n;
  }
  return out;
}

/** Owned personnel cards: counts, filtered to cards this build ships, clamped to the 1-5 star range. */
function cardCounts(v: unknown, knownCardIds: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts(v))) {
    if (!knownCardIds.has(id)) continue;
    const stars = Math.min(5, Math.max(0, Math.round(n)));
    if (stars >= 1) out[id] = stars;
  }
  return out;
}

/** Equip slots: known, owned card ids only, de-duplicated, capped at 8 slots. */
function equippedCards(v: unknown, ownedCardIds: Record<string, number>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v as unknown[]) {
    if (typeof id !== 'string' || !ownedCardIds[id] || out.includes(id)) continue;
    out.push(id);
    if (out.length >= 8) break;
  }
  return out;
}

/** Pity counters: non-negative integers, else the given default. */
function nonNegInt(v: unknown, fallback: number): number {
  const n = num(v, fallback);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Known-id string arrays: skipped dailies, unlocked achievements, seen story beats. */
function knownIds(v: unknown, known: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((id): id is string => typeof id === 'string' && known.has(id));
}

/** Booleans written by a hand-edited save can arrive as 'true' or 1; only a real boolean counts. */
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Timestamps and counters that can never sensibly be negative. */
function nonNeg(v: unknown): number {
  const n = num(v, 0);
  return n >= 0 ? n : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Cosmic Clause and branch ids: de-duplicated and filtered to what this build ships, so a
 * save from a newer build (or a hand-edited one) cannot hand the player a Clause whose effect
 * no longer exists or a branch no department declares.
 */
function stringIds(v: unknown, known: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v as unknown[]) {
    if (typeof id === 'string' && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function sanitizeEntitlements(v: unknown): Entitlements {
  const raw = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    removeAds: bool(raw.removeAds, false),
    unionUntilWall: nonNeg(raw.unionUntilWall),
    starterPackBought: bool(raw.starterPackBought, false),
  };
}

function sanitizeAdState(v: unknown): AdState {
  const raw = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    freePullDate: str(raw.freePullDate),
    dailySkipDate: str(raw.dailySkipDate),
    boostCooldownUntilWall: nonNeg(raw.boostCooldownUntilWall),
  };
}

function sanitizeDailies(v: unknown, knownDailyIds: Set<string>, fallback: DailiesState): DailiesState {
  const raw = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const rawBaseline =
    raw.baseline && typeof raw.baseline === 'object' && !Array.isArray(raw.baseline)
      ? (raw.baseline as Record<string, unknown>)
      : {};
  const tasks = Array.isArray(raw.tasks)
    ? (raw.tasks as unknown[])
        .filter(
          (t): t is { id: string; claimed: boolean } =>
            !!t &&
            typeof t === 'object' &&
            typeof (t as Record<string, unknown>).id === 'string' &&
            knownDailyIds.has((t as Record<string, unknown>).id as string) &&
            typeof (t as Record<string, unknown>).claimed === 'boolean',
        )
        .map((t) => ({ id: t.id, claimed: t.claimed }))
    : [];
  return {
    date: typeof raw.date === 'string' ? raw.date : fallback.date,
    tasks,
    skipped: knownIds(raw.skipped, knownDailyIds),
    streak: num(raw.streak, fallback.streak),
    bestStreak: num(raw.bestStreak, fallback.bestStreak),
    skipTokens: num(raw.skipTokens, fallback.skipTokens),
    lastTokenDate: typeof raw.lastTokenDate === 'string' ? raw.lastTokenDate : fallback.lastTokenDate,
    baseline: {
      clicks: num(rawBaseline.clicks, fallback.baseline.clicks),
      staffHired: num(rawBaseline.staffHired, fallback.baseline.staffHired),
      upgradesBought: num(rawBaseline.upgradesBought, fallback.baseline.upgradesBought),
      equips: num(rawBaseline.equips, fallback.baseline.equips),
      audits: num(rawBaseline.audits, fallback.baseline.audits),
      perksBought: num(rawBaseline.perksBought, fallback.baseline.perksBought),
      pulls: num(rawBaseline.pulls, fallback.baseline.pulls),
      adsWatched: num(rawBaseline.adsWatched, fallback.baseline.adsWatched),
    },
    completedToday: typeof raw.completedToday === 'boolean' ? raw.completedToday : fallback.completedToday,
    soulsPerSecSnapshot: typeof raw.soulsPerSecSnapshot === 'string' ? raw.soulsPerSecSnapshot : fallback.soulsPerSecSnapshot,
  };
}

const NOTIF_OPT_INS: Settings['notifOptIn'][] = ['unasked', 'yes', 'no'];

function sanitizeSettings(v: unknown): Settings {
  const raw = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const notifOptIn = NOTIF_OPT_INS.includes(raw.notifOptIn as Settings['notifOptIn'])
    ? (raw.notifOptIn as Settings['notifOptIn'])
    : 'unasked';
  return {
    notifOptIn,
    notifDate: typeof raw.notifDate === 'string' ? raw.notifDate : '',
    notifsSent: Math.max(0, Math.floor(num(raw.notifsSent, 0))),
  };
}

/** Carried voucher remainder: anything outside [0, 1) is noise from a hand-edited save. */
function fraction(v: unknown): number {
  const n = num(v, 0);
  return n >= 0 && n < 1 ? n : 0;
}

export function deserialize(json: string, content: Content): GameState {
  const raw = migrate(JSON.parse(json) as Record<string, unknown>);
  const base = createInitialState({ wall: 0, mono: 0 }, content);
  const rawStats = (raw.stats ?? {}) as Record<string, unknown>;
  const branchesUnlocked = stringIds(
    raw.branchesUnlocked,
    new Set(content.departments.map((d) => d.branch).filter((b): b is string => !!b)),
  );
  // A save may name a department this build does not ship (a removed one, or one from a
  // newer build rolled back). Drop those rather than booting into a department that
  // findDepartment() will throw on. A branch department goes the same way unless its branch
  // is open, so a hand-edited save cannot walk into Valhalla without the Clause.
  const open = new Set(
    content.departments.filter((d) => !d.branch || branchesUnlocked.includes(d.branch)).map((d) => d.id),
  );
  const kept = Array.isArray(raw.deptsUnlocked)
    ? (raw.deptsUnlocked as unknown[]).filter((id): id is string => typeof id === 'string' && open.has(id))
    : [];
  const deptsUnlocked = kept.length ? kept : base.deptsUnlocked;
  const lastSeenWallClock = num(raw.lastSeenWallClock, 0);
  const knownCardIds = new Set(content.cards.map((c) => c.id));
  const knownDailyIds = new Set(content.dailies.map((d) => d.id));
  const knownAchievementIds = new Set(content.achievements.map((a) => a.id));
  const knownStoryIds = new Set(content.story.map((s) => s.id));
  const cards = cardCounts(raw.cards, knownCardIds);
  const rawPity = raw.pity && typeof raw.pity === 'object' && !Array.isArray(raw.pity) ? (raw.pity as Record<string, unknown>) : {};
  // A save written before a slot-granting perk was refunded (or by a build with more slots)
  // can carry more equipped cards than this state can hold; clampEquipped trims the tail.
  return clampEquipped({
    ...base,
    saveVersion: SAVE_VERSION,
    kc: dec(raw.kc),
    soulsRun: dec(raw.soulsRun),
    soulsLifetime: dec(raw.soulsLifetime),
    seals: num(raw.seals, 0),
    vouchers: num(raw.vouchers, 0),
    voucherFraction: fraction(raw.voucherFraction),
    // Filtered against the shipped perk ids like every other collection: a perk this build
    // does not know would otherwise sit in the tree forever, unrefundable and unpriced, and
    // a duplicated id would apply its effect twice.
    perks: stringIds(raw.perks, new Set(content.perks.map((p) => p.id))),
    staff: counts(raw.staff),
    upgrades: counts(raw.upgrades),
    deptsUnlocked,
    activeDept: deptsUnlocked.includes(raw.activeDept as string) ? (raw.activeDept as string) : deptsUnlocked[0],
    fiscalYear: num(raw.fiscalYear, 1),
    boostUntilWall: num(raw.boostUntilWall, 0),
    lastSeenWallClock,
    uptimeAtSave: num(raw.uptimeAtSave, 0),
    stats: {
      clicks: num(rawStats.clicks, 0),
      staffHired: num(rawStats.staffHired, 0),
      upgradesBought: num(rawStats.upgradesBought, 0),
      audits: num(rawStats.audits, 0),
      pulls: num(rawStats.pulls, 0),
      equips: num(rawStats.equips, 0),
      dailiesClaimed: num(rawStats.dailiesClaimed, 0),
      adsWatched: num(rawStats.adsWatched, 0),
      perksBought: num(rawStats.perksBought, 0),
      cosmics: nonNeg(rawStats.cosmics),
      purchases: nonNeg(rawStats.purchases),
    },
    cards,
    equipped: equippedCards(raw.equipped, cards),
    pity: { senior: nonNegInt(rawPity.senior, 0), executive: nonNegInt(rawPity.executive, 0) },
    rngSeed: (() => {
      // Derived from this save's own last-seen timestamp, so two players falling back never
      // share a pull sequence.
      const fallbackSeed = (Math.floor(Math.abs(lastSeenWallClock)) % 2147483647) || 1;
      const n = num(raw.rngSeed, fallbackSeed);
      return Number.isInteger(n) && n > 0 ? n : fallbackSeed;
    })(),
    dailies: sanitizeDailies(raw.dailies, knownDailyIds, base.dailies),
    achievements: knownIds(raw.achievements, knownAchievementIds),
    storySeen: knownIds(raw.storySeen, knownStoryIds),
    settings: sanitizeSettings(raw.settings),
    firstSeenWallClock: num(raw.firstSeenWallClock, lastSeenWallClock),
    entitlements: sanitizeEntitlements(raw.entitlements),
    adState: sanitizeAdState(raw.adState),
    cosmicPoints: nonNeg(raw.cosmicPoints),
    cosmicClauses: stringIds(raw.cosmicClauses, new Set(content.clauses.map((c) => c.id))),
    branchesUnlocked,
    processId: str(raw.processId),
  }, content);
}
