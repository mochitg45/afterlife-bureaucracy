import Decimal from 'break_infinity.js';
import { createGameStore, CORRUPT_SAVE_KEY } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { loadContent } from '../engine/content';
import intake from '../data/departments/intake.json';
import { createInitialState, serialize } from '../engine/state';
import { AUDIT_BASE, SEAL_COEFF } from '../engine/prestige';

async function make(opts: { saved?: string } = {}) {
  const storage = memoryStorage();
  if (opts.saved) await storage.set(SAVE_KEY, opts.saved);
  const clock = fakeClock({ wall: 1_000_000, mono: 0 });
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
  return { store, storage, clock };
}

/** A second department that opens at 10 000 souls this run. */
const twoDepartments = loadContent([
  intake,
  {
    ...intake, id: 'heaven', name: 'Heaven Admissions', unlockSouls: 10_000,
    staff: intake.staff.map((s) => ({ ...s, id: 'h-' + s.id })),
    upgrades: intake.upgrades.map((u) => ({ ...u, id: 'h-' + u.id })),
  },
]);

/** 20 stamps then one Dave: 0.5 souls/s of passive income. */
function hireDave(store: ReturnType<typeof createGameStore>) {
  for (let i = 0; i < 20; i++) store.getState().stamp();
  store.getState().hire('dave', 1);
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
    hireDave(store);
    expect(store.getState().state.staff.dave).toBe(1);
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5);
    store.getState().stopLoop();
  });

  it('applies offline earnings on boot when away long enough', async () => {
    const s = createInitialState({ wall: 1_000_000 - 3600_000, mono: 0 }, content);
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
    const s = createInitialState({ wall: 1_000_000 - 30_000, mono: 0 }, content);
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

  it('parks an unreadable save instead of wiping it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = memoryStorage();
    await storage.set(SAVE_KEY, '{ this is not a save');
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await store.getState().boot();
    expect(await storage.get(CORRUPT_SAVE_KEY)).toBe('{ this is not a save');
    expect(store.getState().ready).toBe(true);
    expect(store.getState().state.soulsRun.toNumber()).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    store.getState().stopLoop();
  });

  it('doubleOffline goes through addSouls and unlocks departments', async () => {
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content: twoDepartments, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await store.getState().boot();
    store.setState({
      state: { ...store.getState().state, soulsRun: new Decimal(5000), soulsLifetime: new Decimal(5000) },
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(6000), kc: new Decimal(2400), capped: false },
    });
    store.getState().doubleOffline();
    expect(store.getState().state.soulsRun.toNumber()).toBe(11_000);
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(11_000);
    expect(store.getState().state.kc.toNumber()).toBe(2400);
    expect(store.getState().state.deptsUnlocked).toContain('heaven');
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });
});

describe('game store lifecycle', () => {
  it('tick loop credits elapsed monotonic time', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 100, autosaveMs: 1_000_000 });
    await store.getState().boot();
    hireDave(store);
    clock.advance(100);
    vi.advanceTimersByTime(100);
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(20 + 0.05, 3);
    store.getState().stopLoop();
    vi.useRealTimers();
  });

  it('clamps a frozen-tab gap to a few ticks of online income', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 100, autosaveMs: 1_000_000 });
    await store.getState().boot();
    hireDave(store);
    const before = store.getState().state.soulsRun.toNumber();
    clock.advance(60_000);        // the WebView was frozen for a minute
    vi.advanceTimersByTime(100);  // ... and the interval fires once
    // 5 ticks x 100 ms = 0.5 s of online income, not 60 s.
    expect(store.getState().state.soulsRun.toNumber() - before).toBeCloseTo(0.5 * 0.5, 6);
    store.getState().stopLoop();
    vi.useRealTimers();
  });

  it('boot twice starts one loop and returns the same promise', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 100, autosaveMs: 1_000 });
    const first = store.getState().boot();
    const second = store.getState().boot();
    expect(second).toBe(first);
    await first;
    expect(vi.getTimerCount()).toBe(2); // tick + autosave
    await store.getState().boot();
    expect(vi.getTimerCount()).toBe(2);
    store.getState().stopLoop();
    vi.useRealTimers();
  });

  it('pause stops the autosave loop', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000 });
    await store.getState().boot();
    const setSpy = vi.spyOn(storage, 'set');
    await store.getState().pause();
    expect(setSpy).toHaveBeenCalledTimes(1); // the save pause itself performs
    setSpy.mockClear();
    vi.advanceTimersByTime(10_000);
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
    store.getState().stopLoop();
    vi.useRealTimers();
  });

  it('resume after pause credits the gap and restarts the loops', async () => {
    const { store, clock } = await make();
    await store.getState().boot();
    hireDave(store);
    await store.getState().pause();
    const before = store.getState().state.soulsRun.toNumber();
    clock.advance(2 * 3600_000);
    await store.getState().resume();
    const p = store.getState().pendingOffline!;
    expect(p).not.toBeNull();
    expect(p.creditedSec).toBe(7200);
    expect(p.capped).toBe(false);
    expect(store.getState().state.soulsRun.toNumber() - before).toBeCloseTo(0.5 * 7200 * 0.5);
    // save() ran afterwards, so the next gap starts from now
    expect(store.getState().state.lastSeenWallClock).toBe(clock.wall());
    store.getState().stopLoop();
  });

  it('resume caps a very long gap at the offline cap', async () => {
    const { store, clock } = await make();
    await store.getState().boot();
    hireDave(store);
    await store.getState().pause();
    clock.advance(10 * 3600_000);
    await store.getState().resume();
    const p = store.getState().pendingOffline!;
    expect(p.creditedSec).toBe(4 * 3600);
    expect(p.capped).toBe(true);
    store.getState().stopLoop();
  });

  it('two concurrent resumes credit the gap once', async () => {
    const { store, clock } = await make();
    await store.getState().boot();
    hireDave(store);
    await store.getState().pause();
    const before = store.getState().state.soulsRun.toNumber();
    clock.advance(2 * 3600_000);
    const a = store.getState().resume();
    const b = store.getState().resume();
    expect(b).toBe(a);
    await Promise.all([a, b]);
    expect(store.getState().state.soulsRun.toNumber() - before).toBeCloseTo(0.5 * 7200 * 0.5);
    store.getState().stopLoop();
  });

  it('resume before boot boots instead', async () => {
    const { store } = await make();
    await store.getState().resume();
    expect(store.getState().ready).toBe(true);
    store.getState().stopLoop();
  });
});

describe('prestige and perks in the store', () => {
  it('audit resets the run and records the ceremony payload', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.setState({ state: { ...store.getState().state, soulsRun: new Decimal(AUDIT_BASE).mul(4), staff: { dave: 5 } } });
    store.getState().audit();
    const gained = Math.floor(SEAL_COEFF * 4 ** 0.4);
    const s = store.getState();
    expect(s.state.seals).toBe(gained);
    expect(s.state.staff).toEqual({});
    expect(s.lastAudit).toEqual({ sealsGained: gained, fiscalYear: 2 });
    expect(s.rates.soulsPerSec.toNumber()).toBe(0);
    s.dismissAudit();
    expect(store.getState().lastAudit).toBeNull();
    store.getState().stopLoop();
  });
  it('audit clears a pending Overnight Backlog Report', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.setState({
      state: { ...store.getState().state, soulsRun: new Decimal(AUDIT_BASE).mul(4) },
      pendingOffline: { elapsedSec: 3600, creditedSec: 3600, souls: new Decimal(10), kc: new Decimal(4), capped: false },
    });
    store.getState().audit();
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });
  it('audit below threshold is a no-op', async () => {
    const { store } = await make();
    await store.getState().boot();
    const before = store.getState().state;
    store.getState().audit();
    expect(store.getState().state).toBe(before);
    expect(store.getState().lastAudit).toBeNull();
    store.getState().stopLoop();
  });
  it('buyPerk spends seals and raises rates', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.setState({ state: { ...store.getState().state, seals: 5, staff: { dave: 1 } } });
    store.getState().buyPerk('throughput-1');
    expect(store.getState().state.seals).toBe(4);
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5 * 1.08 * 1.1); // 4 seals → ×1.08, perk ×1.1
    store.getState().stopLoop();
  });
  it('memo pool includes late memos from fiscal year 2', async () => {
    const dept = content.departments[0];
    const late = ['MEMO: year two only'];
    const twoYear = { ...content, departments: [{ ...dept, memosLate: late }, ...content.departments.slice(1)] };
    const s2 = createGameStore({ content: twoYear, storage: memoryStorage(), clock: fakeClock({ wall: 1, mono: 0 }), tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await s2.getState().boot();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) { s2.getState().rotateMemo(); seen.add(s2.getState().memoLine); }
    expect(seen.has(late[0])).toBe(false);
    s2.setState({ state: { ...s2.getState().state, fiscalYear: 2 } });
    for (let i = 0; i < 300; i++) { s2.getState().rotateMemo(); seen.add(s2.getState().memoLine); }
    expect(seen.has(late[0])).toBe(true);
    s2.getState().stopLoop();
  });
});
