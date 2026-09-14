import { createGameStore } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { createInitialState, serialize } from '../engine/state';

async function make(opts: { saved?: string } = {}) {
  const storage = memoryStorage();
  if (opts.saved) await storage.set(SAVE_KEY, opts.saved);
  const clock = fakeClock({ wall: 1_000_000, mono: 0 });
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
  return { store, storage, clock };
}

describe('game store', () => {
  it('boots a fresh game when no save exists', async () => {
    const { store } = await make();
    await store.getState().boot();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().state.kc.toNumber()).toBe(0);
    expect(store.getState().pendingOffline).toBeNull();
    expect(store.getState().queueLine.length).toBeGreaterThan(0);
    store.getState().stopLoop();
  });

  it('stamp adds souls and updates rates snapshot', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.getState().stamp();
    expect(store.getState().state.soulsRun.toNumber()).toBe(1);
    expect(store.getState().rates.clickPower.toNumber()).toBe(1);
    store.getState().stopLoop();
  });

  it('hire and upgrade go through the engine', async () => {
    const { store } = await make();
    await store.getState().boot();
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(store.getState().state.staff.dave).toBe(1);
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5);
    store.getState().stopLoop();
  });

  it('applies offline earnings on boot when away long enough', async () => {
    const s = createInitialState({ wall: 1_000_000 - 3600_000, mono: 0 });
    s.staff = { dave: 1 };
    const { store } = await make({ saved: serialize(s) });
    await store.getState().boot();
    const p = store.getState().pendingOffline!;
    expect(p).not.toBeNull();
    expect(p.creditedSec).toBe(3600);
    expect(p.souls.toNumber()).toBeCloseTo(0.5 * 3600 * 0.5);
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(900);
    store.getState().doubleOffline();
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(1800);
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });

  it('does not apply offline for short absences', async () => {
    const s = createInitialState({ wall: 1_000_000 - 30_000, mono: 0 });
    s.staff = { dave: 1 };
    const { store } = await make({ saved: serialize(s) });
    await store.getState().boot();
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });

  it('save writes current clocks', async () => {
    const { store, storage, clock } = await make();
    await store.getState().boot();
    clock.advance(5000);
    await store.getState().save();
    const raw = JSON.parse((await storage.get(SAVE_KEY))!);
    expect(raw.lastSeenWallClock).toBe(1_005_000);
    expect(raw.uptimeAtSave).toBe(5000);
    store.getState().stopLoop();
  });

  it('tick loop credits elapsed monotonic time', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 100, autosaveMs: 1_000_000 });
    await store.getState().boot();
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    clock.advance(100);
    vi.advanceTimersByTime(100);
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(20 + 0.05, 3);
    store.getState().stopLoop();
    vi.useRealTimers();
  });
});
