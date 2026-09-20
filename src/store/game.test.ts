import Decimal from 'break_infinity.js';
import { createGameStore, CORRUPT_SAVE_KEY, BOOT_QUEUE_CAP } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { loadContent } from '../engine/content';
import intake from '../data/departments/intake.json';
import { createInitialState, deserialize, serialize } from '../engine/state';
import { AUDIT_BASE, SEAL_COEFF } from '../engine/prestige';
import type { Ads } from '../platform/ads';

async function make(opts: { saved?: string } = {}) {
  const storage = memoryStorage();
  if (opts.saved) await storage.set(SAVE_KEY, opts.saved);
  const clock = fakeClock({ wall: 1_000_000, mono: 0 });
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
  return { store, storage, clock };
}

function fakeAudio() {
  const played: string[] = [];
  const enabled: { sfx: boolean; music: boolean }[] = [];
  return {
    played, enabled,
    play: (n: string) => { played.push(n); },
    setEnabled: (f: { sfx: boolean; music: boolean }) => { enabled.push(f); },
    unlock: vi.fn(), suspend: vi.fn(), resume: vi.fn(), isRunning: () => true,
  };
}

async function makeWithAudio(wall = 1_000_000) {
  const audio = fakeAudio();
  const store = createGameStore({ content, storage: memoryStorage(), clock: fakeClock({ wall, mono: 0 }), tickMs: 1_000_000, autosaveMs: 1_000_000, audio });
  await store.getState().boot();
  return { store, audio };
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

  it('moves training to the hire step only once Dave is affordable', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.getState().stamp();
    expect(store.getState().state.onboarding.trainingStep).toBe(0);
    for (let i = 0; i < 14; i++) store.getState().stamp();
    expect(store.getState().state.kc.toNumber()).toBe(15);
    expect(store.getState().state.onboarding.trainingStep).toBe(1);
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

  it('doubling the backlog with an ad goes through addSouls and unlocks departments', async () => {
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const ads: Ads = { async init() {}, isReady: () => true, async showRewarded() { return 'rewarded'; } };
    const store = createGameStore({ content: twoDepartments, storage, clock, ads, tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await store.getState().boot();
    store.setState({
      state: { ...store.getState().state, soulsRun: new Decimal(5000), soulsLifetime: new Decimal(5000) },
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(6000), kc: new Decimal(2400), capped: false },
    });
    expect(await store.getState().watchAd('offline-double')).toBe('rewarded');
    expect(store.getState().state.soulsRun.toNumber()).toBe(11_000);
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(11_000);
    expect(store.getState().state.kc.toNumber()).toBe(2400);
    expect(store.getState().state.deptsUnlocked).toContain('heaven');
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });

  it('rearms the audio context once the boot settles', async () => {
    // resume() before the store had booted had nothing to resume; the boot has to do it.
    const { store, audio } = await makeWithAudio();
    expect(audio.resume).toHaveBeenCalled();
    store.getState().stopLoop();
  });

  it('plays a sound for each action that deserves one', async () => {
    const { store, audio } = await makeWithAudio();
    expect(audio.enabled[audio.enabled.length - 1]).toEqual({ sfx: true, music: true });
    store.getState().stamp();
    expect(audio.played).toContain('stamp');
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(audio.played).toContain('hire');
    store.getState().hire('dave', 10); // unaffordable: no sound
    expect(audio.played.filter((n) => n === 'hire')).toHaveLength(1);
    store.getState().setSound({ sfx: false });
    expect(store.getState().state.settings.sfx).toBe(false);
    expect(audio.enabled[audio.enabled.length - 1]).toEqual({ sfx: false, music: true });
    store.getState().stopLoop();
  });

  it('plays the achievement bell when an achievement settles', async () => {
    const { store, audio } = await makeWithAudio();
    for (let i = 0; i < 1000; i++) store.getState().stamp(); // "First Thousand" (a-souls-1)
    expect(audio.played).toContain('achievement');
    store.getState().stopLoop();
  });

  it('plays the reveal sting for the best rarity in a pull', async () => {
    const { store, audio } = await makeWithAudio(0); // wall 0 seeds an executive in the ten-pull (see PersonnelScreen.test)
    store.setState({ state: { ...store.getState().state, vouchers: 90 } });
    store.getState().pull(10);
    expect(audio.played).toContain('pull');
    expect(audio.played).toContain('reveal-executive');
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
    // 4 seals → ×1.08, perk ×1.1, plus the "First Perk Purchased" achievement (×1.01) it now also unlocks.
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5 * 1.08 * 1.1 * 1.01);
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

describe('clock integrity in the store', () => {
  const W0 = 1_700_000_000_000;

  /** A store on its own memory storage, with the tick loop effectively disabled. */
  async function integrityStore(saved?: string) {
    const storage = memoryStorage();
    if (saved) await storage.set(SAVE_KEY, saved);
    const clock = fakeClock({ wall: W0, mono: 10_000 });
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
    return { store, storage, clock };
  }

  it('stamps a fresh process id on boot and writes it to the save', async () => {
    const { store, storage } = await integrityStore();
    await store.getState().boot();
    const id = store.getState().state.processId;
    expect(id).not.toBe('');
    await store.getState().save();
    expect(JSON.parse((await storage.get(SAVE_KEY))!).processId).toBe(id);
    store.getState().stopLoop();
  });

  it('gives two boots of the same save different process ids', async () => {
    const a = await integrityStore();
    await a.store.getState().boot();
    await a.store.getState().save();
    a.store.getState().stopLoop();
    const saved = (await a.storage.get(SAVE_KEY))!;
    const b = await integrityStore(saved);
    await b.store.getState().boot();
    b.store.getState().stopLoop();
    expect(JSON.parse(saved).processId).not.toBe('');
    expect(b.store.getState().state.processId).not.toBe(JSON.parse(saved).processId);
  });

  it('credits nothing and skips the daily rollover when the wall clock moves backwards', async () => {
    const { store, clock } = await integrityStore();
    await store.getState().boot();
    hireDave(store);
    await store.getState().pause();
    const before = store.getState().state.soulsRun.toNumber();
    const dateBefore = store.getState().state.dailies.date;
    expect(dateBefore).not.toBe('');
    clock.setWall(clock.wall() - 2 * 86_400_000);
    await store.getState().resume();
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(before);
    expect(store.getState().pendingOffline).toBeNull();
    expect(store.getState().state.dailies.date).toBe(dateBefore);
    expect(store.getState().clockSuspect).toBe(true);
    store.getState().stopLoop();
  });

  it('credits only the monotonic gap when the wall clock jumps forward mid-process', async () => {
    const { store, clock } = await integrityStore();
    await store.getState().boot();
    hireDave(store);
    await store.getState().pause();
    const before = store.getState().state.soulsRun.toNumber();
    const dateBefore = store.getState().state.dailies.date;
    clock.advance(120_000);                       // two honest minutes of uptime
    clock.setWall(clock.wall() + 3_600_000);      // ... and an hour the clock invented
    await store.getState().resume();
    const p = store.getState().pendingOffline!;
    expect(p).not.toBeNull();
    expect(p.elapsedSec).toBe(120);
    expect(p.creditedSec).toBe(120);
    expect(store.getState().state.soulsRun.toNumber() - before).toBeCloseTo(0.5 * 120 * 0.5);
    expect(store.getState().state.dailies.date).toBe(dateBefore);
    expect(store.getState().clockSuspect).toBe(true);
    store.getState().stopLoop();
  });

  it('credits a sixty-day gap as thirty days', async () => {
    const s = createInitialState({ wall: W0 - 60 * 86_400_000, mono: 0 }, content);
    s.staff = { dave: 1 };
    const { store } = await integrityStore(serialize(s));
    await store.getState().boot();
    const p = store.getState().pendingOffline!;
    expect(p.elapsedSec).toBe(30 * 86_400);
    expect(p.creditedSec).toBe(4 * 3600);  // still bounded by the offline cap
    expect(p.capped).toBe(true);
    expect(store.getState().clockSuspect).toBe(false);
    store.getState().stopLoop();
  });

  it('clears the suspect flag on the next honest boot', async () => {
    const future = createInitialState({ wall: W0 + 2 * 86_400_000, mono: 0 }, content);
    future.staff = { dave: 1 };
    const { store, storage, clock } = await integrityStore(serialize(future));
    await store.getState().boot();
    expect(store.getState().clockSuspect).toBe(true);
    expect(store.getState().pendingOffline).toBeNull();
    await store.getState().save();
    store.getState().stopLoop();

    const again = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await again.getState().boot();
    expect(again.getState().clockSuspect).toBe(false);
    expect(again.getState().state.dailies.date).not.toBe('');
    again.getState().stopLoop();
  });
});

describe('boot queue caps', () => {
  /** A save far enough along that a fresh boot unlocks a whole shelf of memos and badges at once. */
  function loadedSave(): string {
    const s = createInitialState({ wall: 1_000_000, mono: 0 }, content);
    s.soulsLifetime = new Decimal('1e30');
    s.soulsRun = new Decimal('1e30');
    s.kc = new Decimal('1e30');
    s.fiscalYear = 12;
    s.seals = 500;
    s.stats = { ...s.stats, clicks: 100_000, staffHired: 5_000, upgradesBought: 500, audits: 40, pulls: 500, adsWatched: 100 };
    return serialize(s);
  }

  it('shows at most three memos and three badges on boot, filing the rest silently', async () => {
    const { store } = await make({ saved: loadedSave() });
    await store.getState().boot();
    const s = store.getState();
    expect(s.pendingStory.length).toBe(BOOT_QUEUE_CAP);
    expect(s.recentAchievements.length).toBe(BOOT_QUEUE_CAP);
    // Everything that unlocked is recorded, whether or not its memo made the queue.
    expect(s.state.storySeen.length).toBeGreaterThan(BOOT_QUEUE_CAP);
    expect(s.state.achievements.length).toBeGreaterThan(BOOT_QUEUE_CAP);
    expect(s.state.storySeen).toEqual(expect.arrayContaining(s.pendingStory.map((m) => m.id)));
    store.getState().stopLoop();
  });

  // A resume crosses exactly the same pile of triggers as a boot — an app left backgrounded
  // for a week comes back through resume(), not boot() — so it needs the same cap.
  it('caps the same queues on resume', async () => {
    const { store, clock } = await make();
    await store.getState().boot();
    await store.getState().pause();
    store.setState({
      state: deserialize(loadedSave(), content),
      pendingStory: [],
      recentAchievements: [],
    });
    clock.advance(3600_000);
    await store.getState().resume();
    const s = store.getState();
    expect(s.pendingStory.length).toBe(BOOT_QUEUE_CAP);
    expect(s.recentAchievements.length).toBe(BOOT_QUEUE_CAP);
    expect(s.state.storySeen.length).toBeGreaterThan(BOOT_QUEUE_CAP);
    expect(s.state.achievements.length).toBeGreaterThan(BOOT_QUEUE_CAP);
    store.getState().stopLoop();
  });
});

describe('theme setting', () => {
  it('setTheme writes settings and persists across a reload', async () => {
    const { store, storage } = await make();
    await store.getState().boot();
    store.getState().setTheme('dark');
    expect(store.getState().state.settings.theme).toBe('dark');
    await Promise.resolve();
    const reloaded = deserialize((await storage.get(SAVE_KEY)) as string, content);
    expect(reloaded.settings.theme).toBe('dark');
    store.getState().stopLoop();
  });
});

describe('prestige filings settle', () => {
  // fileAudit bumps stats.audits, and nothing else in the app looks at it until the next
  // settle — so before this the "One fiscal year, closed and filed" badge waited a tick.
  it('unlocks the audit-count achievement in the same call', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.setState({
      state: { ...store.getState().state, soulsRun: new Decimal(AUDIT_BASE).mul(4), staff: { dave: 5 } },
    });
    expect(store.getState().state.achievements).not.toContain('a-audits-1');
    store.getState().audit();
    expect(store.getState().state.stats.audits).toBe(1);
    expect(store.getState().state.achievements).toContain('a-audits-1');
    expect(store.getState().recentAchievements.map((a) => a.id)).toContain('a-audits-1');
    store.getState().stopLoop();
  });
});
