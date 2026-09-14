import Decimal from 'break_infinity.js';
import { createWithEqualityFn } from 'zustand/traditional';
import type { Content, DepartmentDef } from '../engine/content';
import { findDepartment } from '../engine/content';
import { createInitialState, deserialize, serialize, type GameState } from '../engine/state';
import { computeRates, type Rates } from '../engine/economy';
import { tickWithRates, click, buyStaff, buyUpgrade, addSouls, unlockDepartments, buyPerk as buyPerkAction, type BuyMode } from '../engine/actions';
import { canAudit, fileAudit } from '../engine/prestige';
import { applyOffline, MIN_OFFLINE_SECONDS } from '../engine/offline';
import { realClock, type Clock } from '../engine/time';
import { pickStorage, SAVE_KEY, type Storage } from '../platform/storage';
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
}

export interface StoreDeps {
  content: Content;
  storage: Storage;
  clock: Clock;
  tickMs?: number;
  autosaveMs?: number;
}

function memoPool(dept: DepartmentDef, fiscalYear: number): string[] {
  return fiscalYear >= 2 && dept.memosLate?.length ? [...dept.memos, ...dept.memosLate] : dept.memos;
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
  const tickMs = deps.tickMs ?? 100;
  const autosaveMs = deps.autosaveMs ?? 10_000;
  const maxTickSec = (MAX_TICKS_PER_FIRE * tickMs) / 1000;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let lastMono = 0;
  let booting: Promise<void> | null = null;
  let booted = false;
  let resuming: Promise<void> | null = null;

  return createWithEqualityFn<GameStore>((set, get) => {
    const apply = (next: GameState) => {
      set({ state: next, rates: computeRates(next, content, clock.wall()) });
    };
    const withClocks = (s: GameState): GameState => ({ ...s, lastSeenWallClock: clock.wall(), uptimeAtSave: clock.mono() });

    /** Credit the wall-clock gap since the state was last seen, if it is worth crediting. */
    const creditOffline = (state: GameState): { state: GameState; pendingOffline: PendingOffline | null } => {
      const elapsedSec = (clock.wall() - state.lastSeenWallClock) / 1000;
      if (elapsedSec < MIN_OFFLINE_SECONDS) return { state, pendingOffline: null };
      const r = applyOffline(state, content, elapsedSec, clock.wall());
      if (r.creditedSec <= 0) return { state: r.state, pendingOffline: null };
      return {
        state: r.state,
        pendingOffline: { elapsedSec: r.elapsedSec, creditedSec: r.creditedSec, souls: r.souls, kc: r.kc, capped: r.capped },
      };
    };

    const startTimers = () => {
      get().stopLoop();
      lastMono = clock.mono();
      tickTimer = setInterval(() => {
        const now = clock.mono();
        const dt = Math.min((now - lastMono) / 1000, maxTickSec);
        lastMono = now;
        const r = tickWithRates(get().state, content, dt, clock.wall());
        set({ state: r.state, rates: r.rates });
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

      boot() {
        if (booting) return booting;
        booting = (async () => {
          const saved = await storage.get(SAVE_KEY);
          let state = createInitialState({ wall: clock.wall(), mono: clock.mono() }, content);
          let pendingOffline: PendingOffline | null = null;
          if (saved) {
            let loaded: GameState | null = null;
            try {
              loaded = deserialize(saved, content);
            } catch (err) {
              console.warn('Unreadable save: keeping a copy at ' + CORRUPT_SAVE_KEY + ' and starting a fresh file.', err);
              await storage.set(CORRUPT_SAVE_KEY, saved);
            }
            if (loaded) ({ state, pendingOffline } = creditOffline(loaded));
          }
          const dept = findDepartment(content, state.activeDept);
          set({
            state,
            rates: computeRates(state, content, clock.wall()),
            ready: true,
            pendingOffline,
            queueLine: pick(dept.queue, ''),
            memoLine: pick(memoPool(dept, state.fiscalYear), ''),
          });
          booted = true;
          startTimers();
        })();
        return booting;
      },

      async pause() {
        get().stopLoop();
        await get().save();
      },

      resume() {
        if (!booted) return get().boot();
        if (resuming) return resuming;
        resuming = (async () => {
          try {
            const { state, pendingOffline } = creditOffline(get().state);
            set({
              state,
              rates: computeRates(state, content, clock.wall()),
              ...(pendingOffline ? { pendingOffline } : {}),
            });
            startTimers();
            await get().save();
          } finally {
            resuming = null;
          }
        })();
        return resuming;
      },

      stamp() { apply(click(get().state, content, clock.wall())); },
      hire(staffId, mode) { apply(buyStaff(get().state, content, staffId, mode)); },
      upgrade(upgradeId) { apply(buyUpgrade(get().state, content, upgradeId)); },
      setActiveDept(deptId) {
        const s = get().state;
        if (!s.deptsUnlocked.includes(deptId)) return;
        const dept = findDepartment(content, deptId);
        set({ state: { ...s, activeDept: deptId }, queueLine: pick(dept.queue, ''), memoLine: pick(memoPool(dept, s.fiscalYear), '') });
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
        set({ memoLine: pick(memoPool(dept, s.fiscalYear), get().memoLine) });
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
          memoLine: pick(memoPool(dept, r.state.fiscalYear), ''),
          // The run those souls belonged to no longer exists; showing the Overnight Backlog
          // Report after the reset would offer to double income into a wiped office.
          pendingOffline: null,
        });
        void get().save();
      },
      dismissAudit() { set({ lastAudit: null }); },
      buyPerk(perkId) { apply(buyPerkAction(get().state, content, perkId)); },
    };
  }, Object.is);
}

export const useGame = createGameStore({ content: defaultContent, storage: pickStorage(), clock: realClock });
