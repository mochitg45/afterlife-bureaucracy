import Decimal from 'break_infinity.js';
import { create } from 'zustand';
import type { Content } from '../engine/content';
import { findDepartment } from '../engine/content';
import { createInitialState, deserialize, serialize, type GameState } from '../engine/state';
import { computeRates, type Rates } from '../engine/economy';
import { tick, click, buyStaff, buyUpgrade, type BuyMode } from '../engine/actions';
import { applyOffline, MIN_OFFLINE_SECONDS } from '../engine/offline';
import { realClock, type Clock } from '../engine/time';
import { pickStorage, SAVE_KEY, type Storage } from '../platform/storage';
import { content as defaultContent } from '../data';

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
  boot(): Promise<void>;
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
}

export interface StoreDeps {
  content: Content;
  storage: Storage;
  clock: Clock;
  tickMs?: number;
  autosaveMs?: number;
}

function pick(lines: string[], avoid: string): string {
  if (lines.length === 1) return lines[0];
  let line = avoid;
  while (line === avoid) line = lines[Math.floor(Math.random() * lines.length)];
  return line;
}

export function createGameStore(deps: StoreDeps) {
  const { content, storage, clock } = deps;
  const tickMs = deps.tickMs ?? 100;
  const autosaveMs = deps.autosaveMs ?? 10_000;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let lastMono = 0;

  return create<GameStore>((set, get) => {
    const apply = (next: GameState) => {
      set({ state: next, rates: computeRates(next, content, clock.mono()) });
    };
    const withClocks = (s: GameState): GameState => ({ ...s, lastSeenWallClock: clock.wall(), uptimeAtSave: clock.mono() });

    return {
      state: createInitialState({ wall: clock.wall(), mono: clock.mono() }),
      rates: computeRates(createInitialState({ wall: 0, mono: 0 }), content, 0),
      ready: false,
      pendingOffline: null,
      queueLine: '',
      memoLine: '',

      async boot() {
        const saved = await storage.get(SAVE_KEY);
        let state: GameState;
        let pendingOffline: PendingOffline | null = null;
        if (saved) {
          try {
            state = deserialize(saved);
          } catch {
            state = createInitialState({ wall: clock.wall(), mono: clock.mono() });
          }
          const elapsedSec = (clock.wall() - state.lastSeenWallClock) / 1000;
          if (elapsedSec >= MIN_OFFLINE_SECONDS) {
            const r = applyOffline(state, content, elapsedSec, clock.mono());
            state = r.state;
            if (r.creditedSec > 0) {
              pendingOffline = { elapsedSec: r.elapsedSec, creditedSec: r.creditedSec, souls: r.souls, kc: r.kc, capped: r.capped };
            }
          }
        } else {
          state = createInitialState({ wall: clock.wall(), mono: clock.mono() });
        }
        const dept = findDepartment(content, state.activeDept);
        set({
          state,
          rates: computeRates(state, content, clock.mono()),
          ready: true,
          pendingOffline,
          queueLine: pick(dept.queue, ''),
          memoLine: pick(dept.memos, ''),
        });
        lastMono = clock.mono();
        get().stopLoop();
        tickTimer = setInterval(() => {
          const now = clock.mono();
          const dt = (now - lastMono) / 1000;
          lastMono = now;
          apply(tick(get().state, content, dt, now));
        }, tickMs);
        saveTimer = setInterval(() => { void get().save(); }, autosaveMs);
      },

      stamp() { apply(click(get().state, content, clock.mono())); },
      hire(staffId, mode) { apply(buyStaff(get().state, content, staffId, mode)); },
      upgrade(upgradeId) { apply(buyUpgrade(get().state, content, upgradeId)); },
      setActiveDept(deptId) {
        const s = get().state;
        if (!s.deptsUnlocked.includes(deptId)) return;
        const dept = findDepartment(content, deptId);
        set({ state: { ...s, activeDept: deptId }, queueLine: pick(dept.queue, ''), memoLine: pick(dept.memos, '') });
      },
      dismissOffline() { set({ pendingOffline: null }); },
      doubleOffline() {
        const p = get().pendingOffline;
        if (!p) return;
        const s = get().state;
        apply({ ...s, soulsRun: s.soulsRun.add(p.souls), soulsLifetime: s.soulsLifetime.add(p.souls), kc: s.kc.add(p.kc) });
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
        const dept = findDepartment(content, get().state.activeDept);
        set({ memoLine: pick(dept.memos, get().memoLine) });
      },
    };
  });
}

export const useGame = createGameStore({ content: defaultContent, storage: pickStorage(), clock: realClock });
