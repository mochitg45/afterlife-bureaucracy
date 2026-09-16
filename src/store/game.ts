import Decimal from 'break_infinity.js';
import { createWithEqualityFn } from 'zustand/traditional';
import type { Content, DepartmentDef, AchievementDef, StoryDef } from '../engine/content';
import { findDepartment } from '../engine/content';
import { createInitialState, deserialize, serialize, type GameState, type Settings } from '../engine/state';
import { computeRates, type Rates } from '../engine/economy';
import { tickWithRates, click, buyStaff, buyUpgrade, addSouls, unlockDepartments, buyPerk as buyPerkAction, type BuyMode } from '../engine/actions';
import { canAudit, fileAudit } from '../engine/prestige';
import { applyOffline, offlineCapSeconds, MIN_OFFLINE_SECONDS } from '../engine/offline';
import { assessGap, type GapAssessment } from '../engine/integrity';
import { realClock, type Clock } from '../engine/time';
import { pickStorage, SAVE_KEY, type Storage } from '../platform/storage';
import { pickNotifications, NOTIF_INTRAY, NOTIF_DAILY, type Notifications } from '../platform/notifications';
import { rollover, claimDaily as claimDailyEngine, skipDaily as skipDailyEngine, skipDailyFree, isDone, progressOf, pickTasks, nextLocalMidnight, dayKey } from '../engine/dailies';
import { checkAchievements } from '../engine/achievements';
import { checkStory } from '../engine/story';
import { pull as pullEngine, equipCard, unequipCard, type PullResult } from '../engine/gacha';
import { canCosmic, fileCosmic, buyClause as buyClauseEngine } from '../engine/cosmic';
import { applyPurchase, starterPackEligible, unionActive } from '../engine/entitlements';
import { pickAds, type AdPlacement, type AdResult, type Ads } from '../platform/ads';
import { pickBilling, type Billing, type Product, type ProductId, type PurchaseResult, type Restored } from '../platform/billing';
import { pickGameServices, type GameServices } from '../platform/gameServices';
import { lifetimeSoulsLeaderboardId, playAchievementIds } from '../platform/gameIds';
import { decodeSave, encodeSave } from '../platform/saveCode';
import { content as defaultContent } from '../data';

/** Where an unreadable save is parked so a bad release cannot erase a player's run. */
export const CORRUPT_SAVE_KEY = SAVE_KEY + '.corrupt';

/**
 * A frozen WebView or a throttled background tab can leave minutes between two
 * interval fires. Credit at most this many ticks of full online income for one
 * fire; the rest of the gap belongs to the offline path, which is capped and
 * pays half rate.
 */
const MAX_TICKS_PER_FIRE = 5;

/** How many times pick() re-draws before accepting a repeat. */
const PICK_ATTEMPTS = 8;

/** The tick loop settles (dailies rollover, achievements, story) only on every Nth fire. */
const SETTLE_EVERY_FIRES = 10;

/** A gap this long (12h) leaves the player "cooked" on return, regardless of the offline cap. */
const COOKED_THRESHOLD_SEC = 43_200;

/** How long after a notification opt-in ask goes unasked before we ask again. */
const ASK_NOTIF_AFTER_MS = 2 * 86_400_000;

/** Minutes-in-ms past local midnight the daily-reset notification fires, so the rollover has landed. */
const DAILY_NOTIF_DELAY_MS = 300_000;

/**
 * In-tray nudges allowed per local day. With the always-scheduled daily-reset reminder that
 * caps the tray at two notifications a day, however often the app is backgrounded.
 */
const MAX_DISCRETIONARY_NOTIFS_PER_DAY = 1;

/**
 * How many story memos and achievement toasts a single boot may queue up. A player returning
 * after a long break (or importing a save) can cross a dozen triggers at once; the rest are
 * already recorded as seen, so the extras are filed silently rather than shown one modal at
 * a time before the office opens.
 */
export const BOOT_QUEUE_CAP = 3;

/** How long the Overtime Boost ad runs the office at double rate. */
export const BOOST_AD_DURATION_MS = 4 * 3600_000;
/**
 * How long the Overtime Boost placement stays closed after one is watched: the four hours of
 * boost plus a four-hour cooldown, so the reward is at most half the day.
 */
export const BOOST_AD_COOLDOWN_MS = 8 * 3600_000;

/**
 * A per-process id, regenerated on every boot. Two boots of the same save must not collide,
 * so that the forward-jump rule only ever fires on a genuine same-process resume.
 *
 * It lives here rather than in the engine: which process is running is the store's business,
 * and the engine only ever compares the ids a save and a caller hand it.
 */
export function newProcessId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
}

/**
 * Lifetime souls are far past a 64-bit score, so the leaderboard ranks their order of
 * magnitude: log10 x 1000, which keeps three decimal places of an exponent as whole points.
 */
export function lifetimeSoulsScore(soulsLifetime: Decimal): number {
  if (soulsLifetime.lte(1)) return 0;
  const score = Math.round(soulsLifetime.log10() * 1000);
  return Number.isFinite(score) ? Math.max(0, score) : 0;
}

/**
 * What a Restore Purchases tap comes back with. `'none'` and `'error'` are different
 * answers on purpose: "this account owns nothing" and "the store did not answer" send the
 * player to very different places.
 */
export type RestoreResult = 'ok' | 'none' | 'error';

export interface PendingOffline {
  elapsedSec: number;
  creditedSec: number;
  souls: Decimal;
  kc: Decimal;
  capped: boolean;
}

export interface GameStore {
  state: GameState;
  rates: Rates;
  ready: boolean;
  pendingOffline: PendingOffline | null;
  queueLine: string;
  memoLine: string;
  lastAudit: { sealsGained: number; fiscalYear: number } | null;
  pendingPull: PullResult[] | null;
  pendingStory: StoryDef[];
  recentAchievements: AchievementDef[];
  mood: 'ok' | 'cooked';
  /**
   * The device clock could not be trusted on the last assessed gap. Sticky for the rest of
   * the session: the daily rollover stays frozen until a boot with an honest gap clears it.
   */
  clockSuspect: boolean;
  /** Whether the ad SDK has an ad to show. Every rewarded button is gated on it. */
  adsReady: boolean;
  /**
   * The placement whose ad is on screen. Single-flight: a second rewarded ad started over
   * the first would spend one day's allowance twice.
   */
  adPending: AdPlacement | null;
  /** The store catalogue, loaded in the background on boot; empty until it lands. */
  products: Product[];
  /** The purchase currently in flight, so the Store tab can disable itself while it runs. */
  purchasePending: ProductId | null;
  /** Payload for the Cosmic Restructuring ceremony, cleared by dismissCosmic. */
  lastCosmic: { pointsGained: number } | null;
  boot(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stamp(): void;
  hire(staffId: string, mode: BuyMode): void;
  upgrade(upgradeId: string): void;
  setActiveDept(deptId: string): void;
  dismissOffline(): void;
  save(): Promise<void>;
  stopLoop(): void;
  rotateQueue(): void;
  rotateMemo(): void;
  audit(): void;
  dismissAudit(): void;
  buyPerk(perkId: string): void;
  pull(count: 1 | 10): void;
  dismissPull(): void;
  equip(cardId: string): void;
  unequip(cardId: string): void;
  claimDaily(taskId: string): void;
  skipDaily(taskId: string): void;
  dismissStory(): void;
  clearAchievementToast(): void;
  setNotifOptIn(v: 'yes' | 'no'): Promise<void>;
  shouldAskNotifications(): boolean;
  watchAd(placement: AdPlacement, taskId?: string): Promise<AdResult>;
  canWatch(placement: AdPlacement): boolean;
  buy(id: ProductId): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  cosmic(): void;
  dismissCosmic(): void;
  buyClause(clauseId: string): void;
  signInGameServices(): Promise<boolean>;
  exportSaveCode(): string;
  importSaveCode(code: string): Promise<'ok' | 'invalid'>;
}

export interface StoreDeps {
  content: Content;
  storage: Storage;
  clock: Clock;
  tickMs?: number;
  autosaveMs?: number;
  notifications?: Notifications;
  ads?: Ads;
  billing?: Billing;
  gameServices?: GameServices;
}

function pick(lines: string[], avoid: string): string {
  if (lines.length === 1) return lines[0];
  let line = avoid;
  for (let i = 0; i < PICK_ATTEMPTS && line === avoid; i++) {
    line = lines[Math.floor(Math.random() * lines.length)];
  }
  return line;
}

export function createGameStore(deps: StoreDeps) {
  const { content, storage, clock } = deps;
  const notifications = deps.notifications ?? pickNotifications();
  const ads = deps.ads ?? pickAds();
  const billing = deps.billing ?? pickBilling();
  const gameServices = deps.gameServices ?? pickGameServices();
  const tickMs = deps.tickMs ?? 100;
  const autosaveMs = deps.autosaveMs ?? 10_000;
  const maxTickSec = (MAX_TICKS_PER_FIRE * tickMs) / 1000;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let lastMono = 0;
  let fires = 0;
  let booting: Promise<void> | null = null;
  let booted = false;
  let resuming: Promise<void> | null = null;
  let processId = '';
  let stopEntitlementUpdates: (() => void) | null = null;
  /**
   * Whether the daily rollover may run — the assessment's own verdict (`allowRollover`),
   * carried between calls. One rule, one name: `clockSuspect` is the *UI and ad* flag and
   * says nothing about the rollover, and this says nothing about the UI.
   *
   * A fresh file has no gap to assess, so it starts honest.
   */
  let allowRollover = true;

  return createWithEqualityFn<GameStore>((set, get) => {
    /** Also folds in the story memos the player has already seen; every department shares them. */
    const memoPool = (dept: DepartmentDef, fiscalYear: number, storySeen: string[]): string[] => {
      const base = fiscalYear >= 2 && dept.memosLate?.length ? [...dept.memos, ...dept.memosLate] : dept.memos;
      const storyTexts = content.story.filter((s) => storySeen.includes(s.id)).map((s) => s.text);
      return [...base, ...storyTexts];
    };

    /**
     * Claims every finished, unclaimed daily in one pass — the Union Membership's "we file
     * your paperwork for you" perk. Each claim pays exactly what claiming it by hand would.
     */
    const autoClaimDailies = (state: GameState): GameState => {
      let next = state;
      // Computed on the first claim rather than read off the store: on the boot settle the
      // store's rates are still the placeholder ones, which would underpay every claim.
      let kcPerSec: Decimal | null = null;
      for (const task of state.dailies.tasks) {
        if (task.claimed) continue;
        const def = content.dailies.find((d) => d.id === task.id);
        if (!def || !isDone(next, def)) continue;
        kcPerSec ??= computeRates(next, content, clock.wall()).kcPerSec;
        next = claimDailyEngine(next, content, task.id, kcPerSec).state;
      }
      return next;
    };

    /**
     * Play Games is cosmetic: an unmapped console id, a signed-out player or a network
     * failure must never reach the game, so unmapped ids are dropped here and the call is
     * fire-and-forget with its rejection swallowed.
     */
    const mirrorAchievements = (unlocked: AchievementDef[]) => {
      if (!unlocked.length) return;
      const ids = playAchievementIds(unlocked.map((a) => a.id));
      if (!ids.length) return;
      gameServices.unlockAchievements(ids).catch(() => {});
    };

    /** Same contract as the achievement mirror: unmapped id, no call; failure, no noise. */
    const submitLifetimeScore = (soulsLifetime: Decimal) => {
      const board = lifetimeSoulsLeaderboardId();
      if (!board) return;
      gameServices.submitScore(board, lifetimeSoulsScore(soulsLifetime)).catch(() => {});
    };

    /**
     * Dailies rollover, then achievements, then story triggers — in that dependency order —
     * and finally the rates, which every caller of settle needs anyway. Unlocking an
     * achievement raises the global multiplier, so the rates have to be computed from the
     * settled state, not the one handed in.
     *
     * The engine holds no rates of its own, so the "reach N souls per second" daily can only
     * be judged against a snapshot; this is where it gets stamped.
     */
    const settle = (
      next: GameState,
      allow: boolean = allowRollover,
    ): { state: GameState; rates: Rates; unlockedAch: AchievementDef[]; unlockedStory: StoryDef[] } => {
      const wall = clock.wall();
      const member = unionActive(next, wall);
      // A rewound or jumped clock would otherwise hand out a fresh set of daily tasks on
      // demand, so the rollover stays frozen until the clock looks honest again.
      const rolled = allow ? rollover(next, content, wall, { unionActive: member, adsReady: get().adsReady }) : next;
      // A membership claims finished paperwork for you; without one the player claims it.
      const claimed = member ? autoClaimDailies(rolled) : rolled;
      const a = checkAchievements(claimed, content);
      const st = checkStory(a.state, content);
      const rates = computeRates(st.state, content, clock.wall());
      const snapshot = rates.soulsPerSec.toString();
      const state =
        st.state.dailies.soulsPerSecSnapshot === snapshot
          ? st.state
          : { ...st.state, dailies: { ...st.state.dailies, soulsPerSecSnapshot: snapshot } };
      mirrorAchievements(a.unlocked);
      return { state, rates, unlockedAch: a.unlocked, unlockedStory: st.unlocked };
    };

    /** The shared write path for any action: settle, then commit state/rates and queue any toasts. */
    const apply = (next: GameState, extra?: Partial<GameStore>) => {
      const r = settle(next);
      set((cur) => ({
        state: r.state,
        rates: r.rates,
        recentAchievements: r.unlockedAch.length ? [...cur.recentAchievements, ...r.unlockedAch] : cur.recentAchievements,
        pendingStory: r.unlockedStory.length ? [...cur.pendingStory, ...r.unlockedStory] : cur.pendingStory,
        ...extra,
      }));
    };

    const withClocks = (s: GameState): GameState => ({ ...s, lastSeenWallClock: clock.wall(), uptimeAtSave: clock.mono() });

    /**
     * The ad SDK finishes initialising well after the daily rollover has run, so a boot that
     * settled with `adsReady: false` drew today's three tasks from a pool the "watch an ad"
     * daily was filtered out of — and on Android that is every boot, so the task would never
     * be drawn at all.
     *
     * Re-draws today's set once, and only while it is untouched: no progress, nothing claimed,
     * nothing skipped. A player who has already started the day keeps the tasks they started.
     */
    const refreshDailiesForAds = () => {
      if (!get().adsReady) return;
      const s = get().state;
      const today = dayKey(clock.wall());
      if (s.dailies.date !== today || s.dailies.skipped.length) return;
      for (const task of s.dailies.tasks) {
        if (task.claimed) return;
        const def = content.dailies.find((d) => d.id === task.id);
        if (!def) continue;
        // 'rate' has no counter to compare against a baseline: its progress is a standing
        // snapshot, so only an already-satisfied one counts as work the player would lose.
        if (def.kind === 'rate' ? isDone(s, def) : progressOf(s, def) > 0) return;
      }
      const picked = pickTasks(content, today, s, { adsReady: true });
      if (!picked.length) return;
      const same =
        picked.length === s.dailies.tasks.length && picked.every((p, i) => p.id === s.dailies.tasks[i].id);
      if (same) return;
      set({ state: { ...s, dailies: { ...s.dailies, tasks: picked.map((t) => ({ id: t.id, claimed: false })) } } });
    };

    /**
     * Folds what the store reports into what the save holds. A merge, never a replacement:
     * a store that answers with less than the save already has (an outage, a receipt that
     * has not caught up, a sync that ran before the subscription was re-validated) takes
     * nothing away. The same rule serves the silent boot/resume sync, the mid-session
     * update listener and the player's own Restore Purchases.
     *
     * Returns whether anything moved, so the caller can skip a pointless write.
     */
    const mergeRestored = (restored: Restored): boolean => {
      const held = get().state.entitlements;
      const merged = {
        removeAds: held.removeAds || restored.removeAds,
        unionUntilWall: Math.max(held.unionUntilWall, restored.unionUntilWall),
        starterPackBought: held.starterPackBought || restored.starterPackBought,
      };
      const changed =
        merged.removeAds !== held.removeAds ||
        merged.unionUntilWall !== held.unionUntilWall ||
        merged.starterPackBought !== held.starterPackBought;
      if (!changed) return false;
      apply({ ...get().state, entitlements: merged });
      return true;
    };

    /**
     * The silent half of the entitlement story: a monthly renewal that happened while the
     * app was closed only reaches the save if something asks the store. `restore()` cannot
     * do that job — it is user-initiated and may raise account prompts — so every boot and
     * resume asks `sync()` instead, and the local +30 d stamp from the purchase itself
     * stays as the offline fallback.
     */
    const syncEntitlements = async (): Promise<void> => {
      let restored: Restored;
      try {
        restored = await billing.sync();
      } catch {
        return; // store unreachable: the save keeps what it holds
      }
      if (mergeRestored(restored)) await get().save();
    };

    /**
     * Credit the gap since the state was last seen, if it is worth crediting. How much of the
     * wall-clock gap is honest is engine/integrity.ts's call, not this store's.
     */
    const creditOffline = (
      state: GameState,
    ): { state: GameState; pendingOffline: PendingOffline | null; elapsedSec: number; assessment: GapAssessment } => {
      const assessment = assessGap(
        { lastSeenWallClock: state.lastSeenWallClock, uptimeAtSave: state.uptimeAtSave, processId: state.processId },
        { wall: clock.wall(), mono: clock.mono(), processId },
      );
      const elapsedSec = assessment.creditSec;
      if (elapsedSec < MIN_OFFLINE_SECONDS) return { state, pendingOffline: null, elapsedSec, assessment };
      const r = applyOffline(state, content, elapsedSec, clock.wall());
      if (r.creditedSec <= 0) return { state: r.state, pendingOffline: null, elapsedSec, assessment };
      return {
        state: r.state,
        pendingOffline: { elapsedSec: r.elapsedSec, creditedSec: r.creditedSec, souls: r.souls, kc: r.kc, capped: r.capped },
        elapsedSec,
        assessment,
      };
    };

    const moodAfterGap = (pendingOffline: PendingOffline | null, elapsedSec: number): GameStore['mood'] =>
      (pendingOffline?.capped || elapsedSec >= COOKED_THRESHOLD_SEC) ? 'cooked' : 'ok';

    const startTimers = () => {
      get().stopLoop();
      lastMono = clock.mono();
      fires = 0;
      tickTimer = setInterval(() => {
        const now = clock.mono();
        const dt = Math.min((now - lastMono) / 1000, maxTickSec);
        lastMono = now;
        const r = tickWithRates(get().state, content, dt, clock.wall());
        fires++;
        if (fires % SETTLE_EVERY_FIRES === 0) {
          apply(r.state);
        } else {
          set({ state: r.state, rates: r.rates });
        }
      }, tickMs);
      saveTimer = setInterval(() => { void get().save(); }, autosaveMs);
    };

    return {
      state: createInitialState({ wall: clock.wall(), mono: clock.mono() }, content),
      rates: computeRates(createInitialState({ wall: 0, mono: 0 }, content), content, 0),
      ready: false,
      pendingOffline: null,
      queueLine: '',
      memoLine: '',
      lastAudit: null,
      pendingPull: null,
      pendingStory: [],
      recentAchievements: [],
      mood: 'ok',
      clockSuspect: false,
      adsReady: false,
      adPending: null,
      products: [],
      purchasePending: null,
      lastCosmic: null,

      boot() {
        if (booting) return booting;
        booting = (async () => {
          // Ads and billing are not on the critical path: the office opens whether or not the
          // networks answer, and each result lands in the store whenever it arrives.
          void (async () => {
            try {
              await ads.init();
            } catch {
              /* no ad SDK: every placement stays closed */
            }
            // Set first, so a boot that has not settled yet draws with ads in the pool;
            // then, once the boot has settled, re-draw a set that was picked without them.
            set({ adsReady: ads.isReady() });
            await booting;
            refreshDailiesForAds();
          })();
          void (async () => {
            try {
              await billing.init();
              set({ products: await billing.products() });
            } catch {
              /* store outage: an empty catalogue, not a broken boot */
            }
            // Ordered after the boot itself: the boot's own set() replaces the whole state,
            // so a merge that landed first would be thrown away. Awaiting the boot promise
            // is safe here — nothing in boot waits on this block.
            await booting;
            // Mid-session renewals (and revocations, which the merge ignores) land through
            // the same never-take-away path as the sync below.
            stopEntitlementUpdates?.();
            stopEntitlementUpdates =
              billing.onUpdate?.((restored) => {
                if (mergeRestored(restored)) void get().save();
              }) ?? null;
            // Runs on every boot, including the one that parked an unreadable save and
            // started a fresh file: Remove Ads and a running membership belong to the
            // account, not to the file that was lost.
            await syncEntitlements();
          })();
          // A fresh id per boot: the forward-jump rule must only ever fire on a resume within
          // this same process, never across a restart where uptime legitimately starts over.
          processId = newProcessId();
          const saved = await storage.get(SAVE_KEY);
          let state = createInitialState({ wall: clock.wall(), mono: clock.mono() }, content);
          let pendingOffline: PendingOffline | null = null;
          let elapsedSec = 0;
          // A fresh file has no gap to assess, so it starts from an honest clock.
          let suspect = false;
          allowRollover = true;
          if (saved) {
            let loaded: GameState | null = null;
            try {
              loaded = deserialize(saved, content);
            } catch (err) {
              console.warn('Unreadable save: keeping a copy at ' + CORRUPT_SAVE_KEY + ' and starting a fresh file.', err);
              await storage.set(CORRUPT_SAVE_KEY, saved);
            }
            if (loaded) {
              const credited = creditOffline(loaded);
              ({ state, pendingOffline, elapsedSec } = credited);
              // This boot's verdict replaces any earlier one: an 'ok' or 'capped' gap is what
              // clears a flag a previous session set.
              suspect = credited.assessment.suspect;
              allowRollover = credited.assessment.allowRollover;
            }
          }
          state = { ...state, processId };
          const r = settle(state, allowRollover);
          const dept = findDepartment(content, r.state.activeDept);
          set((cur) => ({
            state: r.state,
            rates: r.rates,
            ready: true,
            pendingOffline,
            queueLine: pick(dept.queue, ''),
            memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
            recentAchievements: [...cur.recentAchievements, ...r.unlockedAch].slice(0, BOOT_QUEUE_CAP),
            pendingStory: [...cur.pendingStory, ...r.unlockedStory].slice(0, BOOT_QUEUE_CAP),
            mood: moodAfterGap(pendingOffline, elapsedSec),
            clockSuspect: suspect,
          }));
          booted = true;
          startTimers();
          notifications.cancelAll().catch(() => {});
        })();
        return booting;
      },

      async pause() {
        get().stopLoop();
        const s = get().state;
        if (s.settings.notifOptIn !== 'yes') {
          await get().save();
          return;
        }
        const wall = clock.wall();
        const today = dayKey(wall);
        // The budget is per local day, so a player who backgrounds the app a dozen times
        // still gets at most the in-tray nudge plus the daily-reset one.
        const sentToday = s.settings.notifDate === today ? s.settings.notifsSent : 0;
        // An office with no staff produces nothing, so an "in-tray full" nudge would be a lie.
        const intray = sentToday < MAX_DISCRETIONARY_NOTIFS_PER_DAY && get().rates.soulsPerSec.gt(0);
        set({ state: { ...s, settings: { ...s.settings, notifDate: today, notifsSent: sentToday + (intray ? 1 : 0) } } });
        await get().save();
        const items = [];
        if (intray) {
          items.push({
            id: NOTIF_INTRAY,
            atWall: wall + offlineCapSeconds(s, content) * 1000,
            title: 'In-tray full',
            body: 'Your staff have stopped stamping. The backlog is waiting.',
          });
        }
        // Always re-scheduled, never counted: it reuses one id, so it replaces itself rather
        // than stacking up another notification per pause.
        items.push({
          id: NOTIF_DAILY,
          atWall: nextLocalMidnight(wall) + DAILY_NOTIF_DELAY_MS,
          title: 'Daily tasks reset',
          body: 'Three fresh tasks are on your desk.',
        });
        try {
          await notifications.schedule(items);
        } catch {
          /* native scheduling is best-effort */
        }
      },

      resume() {
        if (!booted) return get().boot();
        if (resuming) return resuming;
        resuming = (async () => {
          try {
            const { state, pendingOffline, elapsedSec, assessment } = creditOffline(get().state);
            // A resume can only raise suspicion; only a boot clears it. The rollover gate
            // follows the same one-way rule, under its own name.
            const suspect = get().clockSuspect || assessment.suspect;
            allowRollover = allowRollover && assessment.allowRollover;
            const r = settle(state, allowRollover);
            set((cur) => ({
              state: r.state,
              rates: r.rates,
              ...(pendingOffline ? { pendingOffline } : {}),
              // Capped exactly as on boot: a resume after a week away crosses the same pile
              // of triggers, and the rest are already recorded as seen, so they are filed
              // silently rather than shown one modal at a time.
              recentAchievements: [...cur.recentAchievements, ...r.unlockedAch].slice(0, BOOT_QUEUE_CAP),
              pendingStory: [...cur.pendingStory, ...r.unlockedStory].slice(0, BOOT_QUEUE_CAP),
              mood: moodAfterGap(pendingOffline, elapsedSec),
              clockSuspect: suspect,
            }));
            notifications.cancelAll().catch(() => {});
            set({ adsReady: ads.isReady() });
            refreshDailiesForAds();
            startTimers();
            // After the set above, never before it: a resume replaces the whole state too.
            await syncEntitlements();
            await get().save();
          } finally {
            resuming = null;
          }
        })();
        return resuming;
      },

      stamp() { apply(click(get().state, content, clock.wall()), { mood: 'ok' }); },
      hire(staffId, mode) { apply(buyStaff(get().state, content, staffId, mode)); },
      upgrade(upgradeId) { apply(buyUpgrade(get().state, content, upgradeId)); },
      setActiveDept(deptId) {
        const s = get().state;
        if (!s.deptsUnlocked.includes(deptId)) return;
        const dept = findDepartment(content, deptId);
        set({ state: { ...s, activeDept: deptId }, queueLine: pick(dept.queue, ''), memoLine: pick(memoPool(dept, s.fiscalYear, s.storySeen), '') });
      },
      dismissOffline() { set({ pendingOffline: null }); },
      async save() {
        const s = withClocks(get().state);
        set({ state: s });
        await storage.set(SAVE_KEY, serialize(s));
      },
      stopLoop() {
        if (tickTimer) clearInterval(tickTimer);
        if (saveTimer) clearInterval(saveTimer);
        tickTimer = null;
        saveTimer = null;
      },
      rotateQueue() {
        const dept = findDepartment(content, get().state.activeDept);
        set({ queueLine: pick(dept.queue, get().queueLine) });
      },
      rotateMemo() {
        const s = get().state;
        const dept = findDepartment(content, s.activeDept);
        set({ memoLine: pick(memoPool(dept, s.fiscalYear, s.storySeen), get().memoLine) });
      },
      audit() {
        if (!canAudit(get().state)) return;
        const r = fileAudit(get().state, content);
        const dept = findDepartment(content, r.state.activeDept);
        // Through `apply`, like every other write: filing the audit is what satisfies the
        // "file N audits" achievement and the story beats keyed to the fiscal year, so they
        // have to unlock in this same call rather than waiting for the next tick to notice.
        apply(r.state, {
          lastAudit: { sealsGained: r.sealsGained, fiscalYear: r.fiscalYear },
          queueLine: pick(dept.queue, ''),
          memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
          // The run those souls belonged to no longer exists; showing the Overnight Backlog
          // Report after the reset would offer to double income into a wiped office.
          pendingOffline: null,
        });
        submitLifetimeScore(get().state.soulsLifetime);
        void get().save();
      },
      dismissAudit() { set({ lastAudit: null }); },
      buyPerk(perkId) { apply(buyPerkAction(get().state, content, perkId)); },
      pull(count) {
        const r = pullEngine(get().state, content, count, get().rates.kcPerSec);
        if (r.results.length) {
          apply(r.state, { pendingPull: r.results });
        }
      },
      dismissPull() { set({ pendingPull: null }); },
      equip(cardId) { apply(equipCard(get().state, content, cardId)); },
      unequip(cardId) { apply(unequipCard(get().state, cardId)); },
      claimDaily(taskId) {
        const r = claimDailyEngine(get().state, content, taskId, get().rates.kcPerSec);
        apply(r.state);
      },
      skipDaily(taskId) { apply(skipDailyEngine(get().state, content, taskId)); },
      dismissStory() { set((cur) => ({ pendingStory: cur.pendingStory.slice(1) })); },
      clearAchievementToast() { set((cur) => ({ recentAchievements: cur.recentAchievements.slice(1) })); },
      async setNotifOptIn(v) {
        let notifOptIn: Settings['notifOptIn'] = 'no';
        if (v === 'yes') {
          const granted = await notifications.requestPermission();
          notifOptIn = granted ? 'yes' : 'no';
        }
        apply({ ...get().state, settings: { ...get().state.settings, notifOptIn } });
        await get().save();
      },
      shouldAskNotifications() {
        const s = get().state;
        return s.settings.notifOptIn === 'unasked' && clock.wall() - s.firstSeenWallClock >= ASK_NOTIF_AFTER_MS;
      },

      canWatch(placement) {
        if (!get().adsReady) return false;
        // Every placement's allowance is keyed to a day or a wall-clock cooldown, so a clock
        // that cannot be trusted can farm all four. Closed until an honest boot clears it.
        if (get().clockSuspect) return false;
        const s = get().state;
        const wall = clock.wall();
        switch (placement) {
          case 'offline-double':
            // Nothing to double once the Backlog Report has been dismissed or claimed.
            return get().pendingOffline !== null;
          case 'overtime-boost':
            return s.adState.boostCooldownUntilWall <= wall;
          case 'free-pull':
            return s.adState.freePullDate !== dayKey(wall);
          case 'daily-skip':
            return s.adState.dailySkipDate !== dayKey(wall);
          default:
            return false;
        }
      },

      async watchAd(placement, taskId) {
        // Single-flight across every placement: two ads in flight would each check the gate
        // before either had spent it.
        if (get().adPending) return 'unavailable';
        if (!get().canWatch(placement)) return 'unavailable';
        // Checked before the ad plays: nobody watches thirty seconds for a reward that has
        // nowhere to land.
        if (placement === 'daily-skip' && !taskId) return 'unavailable';
        let result: AdResult;
        set({ adPending: placement });
        try {
          result = await ads.showRewarded(placement);
        } catch {
          return 'unavailable';
        } finally {
          set({ adPending: null });
        }
        if (result !== 'rewarded') return result;

        // An ad is thirty seconds the device clock could be nudged through, and a placement's
        // allowance is spent against the day it is granted on. Re-assess the gap, then ask
        // canWatch again on the fresh state — not a raw read of the flag that was true when
        // the ad started — so a midnight crossed mid-ad cannot spend two days of one placement.
        const s = get().state;
        const assessment = assessGap(
          { lastSeenWallClock: s.lastSeenWallClock, uptimeAtSave: s.uptimeAtSave, processId: s.processId },
          { wall: clock.wall(), mono: clock.mono(), processId },
        );
        if (assessment.suspect) set({ clockSuspect: true });
        if (!assessment.allowRollover) allowRollover = false;
        if (!get().canWatch(placement)) return 'unavailable';

        const wall = clock.wall();
        const today = dayKey(wall);
        const base = get().state;
        let next: GameState = { ...base, stats: { ...base.stats, adsWatched: base.stats.adsWatched + 1 } };
        let extra: Partial<GameStore> = {};
        switch (placement) {
          case 'offline-double': {
            const p = get().pendingOffline;
            if (p) {
              next = unlockDepartments(addSouls(next, p.souls, p.kc), content);
              extra = { pendingOffline: null };
            }
            break;
          }
          case 'overtime-boost':
            next = {
              ...next,
              boostUntilWall: wall + BOOST_AD_DURATION_MS,
              adState: { ...next.adState, boostCooldownUntilWall: wall + BOOST_AD_COOLDOWN_MS },
            };
            break;
          case 'free-pull': {
            const r = pullEngine(next, content, 1, get().rates.kcPerSec, { free: true });
            next = { ...r.state, adState: { ...r.state.adState, freePullDate: today } };
            extra = { pendingPull: r.results };
            break;
          }
          case 'daily-skip': {
            // A task that turned out to be finished (or unknown) costs the player the ad but
            // not the day's write-off, so they can still spend one on a task that needs it.
            const skipped = skipDailyFree(next, content, taskId as string);
            if (skipped !== next) next = { ...skipped, adState: { ...skipped.adState, dailySkipDate: today } };
            break;
          }
        }
        apply(next, extra);
        void get().save();
        return 'rewarded';
      },

      async buy(id) {
        // One flow at a time: a second checkout sheet over the first is a double charge
        // waiting to happen.
        if (get().purchasePending) return 'error';
        // Eligibility is decided before the player is charged, never after.
        if (id === 'starter_pack' && !starterPackEligible(get().state, clock.wall())) return 'error';
        set({ purchasePending: id });
        let result: PurchaseResult;
        try {
          result = await billing.purchase(id);
        } catch {
          result = 'error';
        } finally {
          set({ purchasePending: null });
        }
        if (result !== 'ok') return result;
        apply(applyPurchase(get().state, content, id, clock.wall(), get().rates.kcPerSec));
        void get().save();
        return 'ok';
      },

      async restorePurchases() {
        let restored: Restored;
        try {
          restored = await billing.restore();
        } catch {
          return 'error';
        }
        mergeRestored(restored);
        await get().save();
        // Reported on what the store said this account owns, not on whether the merge moved
        // anything: restoring onto a device that already holds everything is still a success.
        const owns = restored.removeAds || restored.unionUntilWall > 0 || restored.starterPackBought;
        return owns ? 'ok' : 'none';
      },

      cosmic() {
        if (!canCosmic(get().state)) return;
        const r = fileCosmic(get().state, content);
        const dept = findDepartment(content, r.state.activeDept);
        // Settles for the same reason the Audit does: the cosmic-count achievement belongs
        // to the filing that earned it.
        apply(r.state, {
          lastCosmic: { pointsGained: r.pointsGained },
          queueLine: pick(dept.queue, ''),
          memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
          // The run those souls belonged to is gone, exactly as after an Audit.
          pendingOffline: null,
        });
        void get().save();
      },
      dismissCosmic() { set({ lastCosmic: null }); },
      buyClause(clauseId) { apply(buyClauseEngine(get().state, content, clauseId)); },

      async signInGameServices() {
        try {
          return await gameServices.signIn();
        } catch {
          return false;
        }
      },

      exportSaveCode() {
        const s = withClocks(get().state);
        // A save code carries a run, never a receipt. Purchases belong to the store account
        // that paid for them, so a shared code cannot hand anyone Remove Ads or a membership.
        return encodeSave(
          serialize({
            ...s,
            entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false },
            stats: { ...s.stats, purchases: 0 },
          }),
        );
      },

      async importSaveCode(code) {
        let imported: GameState;
        try {
          imported = deserialize(decodeSave(code), content);
        } catch {
          // Nothing has been written yet, so a bad code leaves the running save untouched.
          return 'invalid';
        }
        // The other half of the export rule: whatever the code claims about entitlements, the
        // importer keeps their own. An old code exported before the strip cannot grant any.
        const mine = get().state;
        // The imported clocks belong to another device: adopting them would credit (or refuse)
        // an offline gap this player never had.
        const r = settle({
          ...imported,
          processId,
          lastSeenWallClock: clock.wall(),
          uptimeAtSave: clock.mono(),
          entitlements: mine.entitlements,
          stats: { ...imported.stats, purchases: mine.stats.purchases },
        });
        const dept = findDepartment(content, r.state.activeDept);
        set({
          state: r.state,
          rates: r.rates,
          pendingOffline: null,
          pendingPull: null,
          lastAudit: null,
          lastCosmic: null,
          queueLine: pick(dept.queue, ''),
          memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
        });
        // The imported file is a different run: restart the loop so the tick's elapsed-time
        // baseline and the autosave belong to it, not to the run it replaced.
        startTimers();
        await get().save();
        return 'ok';
      },
    };
  }, Object.is);
}

export const useGame = createGameStore({ content: defaultContent, storage: pickStorage(), clock: realClock });
