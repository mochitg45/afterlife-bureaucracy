import Decimal from 'break_infinity.js';
import { createWithEqualityFn } from 'zustand/traditional';
import type { Content, DepartmentDef, AchievementDef, StoryDef } from '../engine/content';
import { findDepartment } from '../engine/content';
import { createInitialState, deserialize, serialize, type GameState, type Settings } from '../engine/state';
import { computeRates, type Rates } from '../engine/economy';
import { tickWithRates, click, buyStaff, buyUpgrade, addSouls, unlockDepartments, buyPerk as buyPerkAction, type BuyMode } from '../engine/actions';
import { canAudit, fileAudit } from '../engine/prestige';
import { applyOffline, offlineCapSeconds, MIN_OFFLINE_SECONDS } from '../engine/offline';
import { realClock, type Clock } from '../engine/time';
import { pickStorage, SAVE_KEY, type Storage } from '../platform/storage';
import { pickNotifications, NOTIF_INTRAY, NOTIF_DAILY, type Notifications } from '../platform/notifications';
import { rollover, claimDaily as claimDailyEngine, skipDaily as skipDailyEngine, nextLocalMidnight } from '../engine/dailies';
import { checkAchievements } from '../engine/achievements';
import { checkStory } from '../engine/story';
import { pull as pullEngine, equipCard, unequipCard, type PullResult } from '../engine/gacha';
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
  boot(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stamp(): void;
  hire(staffId: string, mode: BuyMode): void;
  upgrade(upgradeId: string): void;
  setActiveDept(deptId: string): void;
  dismissOffline(): void;
  doubleOffline(): void;
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
}

export interface StoreDeps {
  content: Content;
  storage: Storage;
  clock: Clock;
  tickMs?: number;
  autosaveMs?: number;
  notifications?: Notifications;
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

  return createWithEqualityFn<GameStore>((set, get) => {
    /** Also folds in the story memos the player has already seen; every department shares them. */
    const memoPool = (dept: DepartmentDef, fiscalYear: number, storySeen: string[]): string[] => {
      const base = fiscalYear >= 2 && dept.memosLate?.length ? [...dept.memos, ...dept.memosLate] : dept.memos;
      const storyTexts = content.story.filter((s) => storySeen.includes(s.id)).map((s) => s.text);
      return [...base, ...storyTexts];
    };

    /** Dailies rollover, then achievements, then story triggers — in that dependency order. */
    const settle = (next: GameState): { state: GameState; unlockedAch: AchievementDef[]; unlockedStory: StoryDef[] } => {
      const rolled = rollover(next, content, clock.wall());
      const a = checkAchievements(rolled, content);
      const st = checkStory(a.state, content);
      return { state: st.state, unlockedAch: a.unlocked, unlockedStory: st.unlocked };
    };

    /** The shared write path for any action: settle, then commit state/rates and queue any toasts. */
    const apply = (next: GameState, extra?: Partial<GameStore>) => {
      const r = settle(next);
      set((cur) => ({
        state: r.state,
        rates: computeRates(r.state, content, clock.wall()),
        recentAchievements: r.unlockedAch.length ? [...cur.recentAchievements, ...r.unlockedAch] : cur.recentAchievements,
        pendingStory: r.unlockedStory.length ? [...cur.pendingStory, ...r.unlockedStory] : cur.pendingStory,
        ...extra,
      }));
    };

    const withClocks = (s: GameState): GameState => ({ ...s, lastSeenWallClock: clock.wall(), uptimeAtSave: clock.mono() });

    /** Credit the wall-clock gap since the state was last seen, if it is worth crediting. */
    const creditOffline = (state: GameState): { state: GameState; pendingOffline: PendingOffline | null; elapsedSec: number } => {
      const elapsedSec = (clock.wall() - state.lastSeenWallClock) / 1000;
      if (elapsedSec < MIN_OFFLINE_SECONDS) return { state, pendingOffline: null, elapsedSec };
      const r = applyOffline(state, content, elapsedSec, clock.wall());
      if (r.creditedSec <= 0) return { state: r.state, pendingOffline: null, elapsedSec };
      return {
        state: r.state,
        pendingOffline: { elapsedSec: r.elapsedSec, creditedSec: r.creditedSec, souls: r.souls, kc: r.kc, capped: r.capped },
        elapsedSec,
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

      boot() {
        if (booting) return booting;
        booting = (async () => {
          const saved = await storage.get(SAVE_KEY);
          let state = createInitialState({ wall: clock.wall(), mono: clock.mono() }, content);
          let pendingOffline: PendingOffline | null = null;
          let elapsedSec = 0;
          if (saved) {
            let loaded: GameState | null = null;
            try {
              loaded = deserialize(saved, content);
            } catch (err) {
              console.warn('Unreadable save: keeping a copy at ' + CORRUPT_SAVE_KEY + ' and starting a fresh file.', err);
              await storage.set(CORRUPT_SAVE_KEY, saved);
            }
            if (loaded) ({ state, pendingOffline, elapsedSec } = creditOffline(loaded));
          }
          const r = settle(state);
          const dept = findDepartment(content, r.state.activeDept);
          set((cur) => ({
            state: r.state,
            rates: computeRates(r.state, content, clock.wall()),
            ready: true,
            pendingOffline,
            queueLine: pick(dept.queue, ''),
            memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
            recentAchievements: r.unlockedAch.length ? [...cur.recentAchievements, ...r.unlockedAch] : cur.recentAchievements,
            pendingStory: r.unlockedStory.length ? [...cur.pendingStory, ...r.unlockedStory] : cur.pendingStory,
            mood: moodAfterGap(pendingOffline, elapsedSec),
          }));
          booted = true;
          startTimers();
          notifications.cancelAll().catch(() => {});
        })();
        return booting;
      },

      async pause() {
        get().stopLoop();
        await get().save();
        const s = get().state;
        if (s.settings.notifOptIn === 'yes') {
          const wall = clock.wall();
          try {
            await notifications.schedule([
              {
                id: NOTIF_INTRAY,
                atWall: wall + offlineCapSeconds(s, content) * 1000,
                title: 'In-tray full',
                body: 'Your staff have stopped stamping. The backlog is waiting.',
              },
              {
                id: NOTIF_DAILY,
                atWall: nextLocalMidnight(wall) + DAILY_NOTIF_DELAY_MS,
                title: 'Daily tasks reset',
                body: 'Three fresh tasks are on your desk.',
              },
            ]);
          } catch {
            /* native scheduling is best-effort */
          }
        }
      },

      resume() {
        if (!booted) return get().boot();
        if (resuming) return resuming;
        resuming = (async () => {
          try {
            const { state, pendingOffline, elapsedSec } = creditOffline(get().state);
            const r = settle(state);
            set((cur) => ({
              state: r.state,
              rates: computeRates(r.state, content, clock.wall()),
              ...(pendingOffline ? { pendingOffline } : {}),
              recentAchievements: r.unlockedAch.length ? [...cur.recentAchievements, ...r.unlockedAch] : cur.recentAchievements,
              pendingStory: r.unlockedStory.length ? [...cur.pendingStory, ...r.unlockedStory] : cur.pendingStory,
              mood: moodAfterGap(pendingOffline, elapsedSec),
            }));
            notifications.cancelAll().catch(() => {});
            startTimers();
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
      doubleOffline() {
        const p = get().pendingOffline;
        if (!p) return;
        apply(unlockDepartments(addSouls(get().state, p.souls, p.kc), content));
        set({ pendingOffline: null });
      },
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
        set({
          state: r.state,
          rates: computeRates(r.state, content, clock.wall()),
          lastAudit: { sealsGained: r.sealsGained, fiscalYear: r.fiscalYear },
          queueLine: pick(dept.queue, ''),
          memoLine: pick(memoPool(dept, r.state.fiscalYear, r.state.storySeen), ''),
          // The run those souls belonged to no longer exists; showing the Overnight Backlog
          // Report after the reset would offer to double income into a wiped office.
          pendingOffline: null,
        });
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
    };
  }, Object.is);
}

export const useGame = createGameStore({ content: defaultContent, storage: pickStorage(), clock: realClock });
