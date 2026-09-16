import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { createInitialState, deserialize, serialize, type GameState } from '../engine/state';
import { memoryCloudSave, type CloudSnapshot } from '../platform/cloudSave';
import type { GameServices } from '../platform/gameServices';

const T0 = new Date(2026, 8, 16, 9).getTime();

function fakeServices() {
  const calls: string[] = [];
  let signedIn = false;
  const services: GameServices = {
    async signIn() { calls.push('signIn'); signedIn = true; return true; },
    isSignedIn: () => signedIn,
    async unlockAchievements() {},
    async submitScore() {},
  };
  return { services, calls };
}

/** A save as another device would have written it: same shape, its own numbers and stamp. */
function saveState(patch: Partial<GameState>, wall = T0): GameState {
  return { ...createInitialState({ wall, mono: 0 }, content), ...patch };
}

function snapshotOf(s: GameState): CloudSnapshot {
  return { data: serialize(s), savedAtWall: s.savedAtWall };
}

type CloudOpts = Parameters<typeof memoryCloudSave>[0];

async function make(opts: { saved?: GameState; cloud?: CloudOpts; autosaveMs?: number } = {}) {
  const storage = memoryStorage();
  if (opts.saved) await storage.set(SAVE_KEY, serialize(opts.saved));
  const clock = fakeClock({ wall: T0, mono: 0 });
  const cloud = memoryCloudSave(opts.cloud);
  const services = fakeServices();
  const store = createGameStore({
    content, storage, clock,
    tickMs: 1_000_000,
    autosaveMs: opts.autosaveMs ?? 1_000_000,
    cloudSave: cloud,
    gameServices: services.services,
  });
  return { store, storage, clock, cloud, services };
}

/** The boot cloud sync runs behind the boot itself, like the billing sync does. */
async function bootSynced(store: ReturnType<typeof createGameStore>, expected: string) {
  await store.getState().boot();
  await vi.waitFor(() => expect(store.getState().cloud.lastResult).toBe(expected));
}

describe('cloud sync on boot', () => {
  it('downloads a richer cloud save and shows the notice', async () => {
    const cloudState = saveState({
      soulsLifetime: new Decimal(5_000), soulsRun: new Decimal(5_000), savedAtWall: T0 - 60_000,
    });
    const { store, cloud } = await make({ cloud: { signedIn: true, snapshot: snapshotOf(cloudState) } });
    await bootSynced(store, 'downloaded');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(5_000);
    const notice = store.getState().cloudNotice!;
    expect(notice.kind).toBe('downloaded');
    expect(notice.summary!.soulsLifetime.toNumber()).toBe(5_000);
    expect(notice.summary!.savedAtWall).toBe(T0 - 60_000);
    // The download is the winner, so nothing is pushed back over it.
    expect(cloud.snapshot!.data).toBe(snapshotOf(cloudState).data);
    store.getState().dismissCloudNotice();
    expect(store.getState().cloudNotice).toBeNull();
    store.getState().stopLoop();
  });

  it('keeps a richer local save, uploads it and reports what the cloud held', async () => {
    const local = saveState({ soulsLifetime: new Decimal(9_000), soulsRun: new Decimal(9_000), savedAtWall: T0 - 5_000 });
    const remote = saveState({ soulsLifetime: new Decimal(10), soulsRun: new Decimal(10), savedAtWall: T0 - 90_000 });
    const { store, cloud } = await make({ saved: local, cloud: { signedIn: true, snapshot: snapshotOf(remote) } });
    await bootSynced(store, 'kept-local');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(9_000);
    expect(deserialize(cloud.snapshot!.data, content).soulsLifetime.toNumber()).toBe(9_000);
    const notice = store.getState().cloudNotice!;
    expect(notice.kind).toBe('kept-local');
    expect(notice.summary!.soulsLifetime.toNumber()).toBe(10);
    store.getState().stopLoop();
  });

  it('says nothing when the two saves are the same run', async () => {
    const local = saveState({ soulsLifetime: new Decimal(500), soulsRun: new Decimal(500), savedAtWall: T0 - 5_000 });
    const { store } = await make({ saved: local, cloud: { signedIn: true, snapshot: snapshotOf(local) } });
    await bootSynced(store, 'kept-local');
    expect(store.getState().cloudNotice).toBeNull();
    store.getState().stopLoop();
  });

  it('uploads when the cloud slot is empty and records the sync in the save', async () => {
    const local = saveState({ soulsLifetime: new Decimal(42), soulsRun: new Decimal(42) });
    const { store, cloud, storage } = await make({ saved: local, cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    expect(cloud.snapshot).not.toBeNull();
    expect(deserialize(cloud.snapshot!.data, content).soulsLifetime.toNumber()).toBe(42);
    // save() stamps the wall clock the upload is judged by.
    expect(cloud.snapshot!.savedAtWall).toBe(T0);
    expect(store.getState().state.cloud).toEqual({ lastSyncWall: T0, lastResult: 'uploaded' });
    expect(store.getState().cloudNotice).toBeNull();
    await store.getState().save();
    expect(deserialize((await storage.get(SAVE_KEY))!, content).cloud.lastResult).toBe('uploaded');
    store.getState().stopLoop();
  });

  it('does not sync when the player is signed out', async () => {
    const { store, cloud } = await make({ cloud: { signedIn: false } });
    await store.getState().boot();
    expect(store.getState().cloud.lastResult).toBe('none');
    expect(cloud.snapshot).toBeNull();
    store.getState().stopLoop();
  });

  it('leaves a corrupt cloud payload alone and reports an error', async () => {
    const local = saveState({ soulsLifetime: new Decimal(700), soulsRun: new Decimal(700) });
    const { store, cloud } = await make({
      saved: local,
      cloud: { signedIn: true, snapshot: { data: '{ not a save', savedAtWall: T0 } },
    });
    await bootSynced(store, 'error');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(700);
    expect(cloud.snapshot!.data).toBe('{ not a save');
    expect(store.getState().cloudNotice).toEqual({ kind: 'error' });
    store.getState().stopLoop();
  });

  it('never uploads while the device clock is suspect', async () => {
    const { store, cloud } = await make({ cloud: { signedIn: true } });
    await store.getState().boot();
    store.setState({ clockSuspect: true });
    expect(await store.getState().syncCloud('manual')).toBe('none');
    expect(cloud.snapshot).toBeNull();
    store.getState().stopLoop();
  });

  it('never uploads after an unreadable save was parked', async () => {
    const storage = memoryStorage();
    await storage.set(SAVE_KEY, 'not json at all');
    const clock = fakeClock({ wall: T0, mono: 0 });
    const cloud = memoryCloudSave({ signedIn: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000, cloudSave: cloud });
    await store.getState().boot();
    expect(await store.getState().syncCloud('manual')).toBe('none');
    expect(await store.getState().uploadLocal()).toBe('none');
    expect(cloud.snapshot).toBeNull();
    warn.mockRestore();
    store.getState().stopLoop();
  });

  it('keeps entitlements bought on this device through a download', async () => {
    const local = saveState({
      soulsLifetime: new Decimal(1), soulsRun: new Decimal(1),
      entitlements: { removeAds: true, unionUntilWall: T0 + 86_400_000, starterPackBought: true },
    });
    const remote = saveState({
      soulsLifetime: new Decimal(80_000), soulsRun: new Decimal(80_000), savedAtWall: T0 - 1_000,
    });
    const { store } = await make({ saved: local, cloud: { signedIn: true, snapshot: snapshotOf(remote) } });
    await bootSynced(store, 'downloaded');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(80_000);
    expect(store.getState().state.entitlements.removeAds).toBe(true);
    expect(store.getState().state.entitlements.starterPackBought).toBe(true);
    expect(store.getState().state.entitlements.unionUntilWall).toBe(T0 + 86_400_000);
    store.getState().stopLoop();
  });

  it('says nothing about the copy this device pushed itself', async () => {
    const local = saveState({ soulsLifetime: new Decimal(100), soulsRun: new Decimal(100) });
    const { store, clock } = await make({ saved: local, cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    // The autosave re-stamps savedAtWall every few seconds, so the stamps no longer match.
    clock.advance(10_000);
    await store.getState().save();
    expect(await store.getState().syncCloud('auto')).toBe('kept-local');
    expect(store.getState().cloudNotice).toBeNull();
    store.getState().stopLoop();
  });

  it('does speak up when another writer has touched the slot', async () => {
    const local = saveState({ soulsLifetime: new Decimal(100), soulsRun: new Decimal(100) });
    const { store, cloud, clock } = await make({ saved: local, cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    const other = saveState({ soulsLifetime: new Decimal(5), soulsRun: new Decimal(5), savedAtWall: T0 - 500 });
    cloud.snapshot = snapshotOf(other);
    clock.advance(10_000);
    expect(await store.getState().syncCloud('manual')).toBe('kept-local');
    expect(store.getState().cloudNotice!.kind).toBe('kept-local');
    expect(store.getState().cloudNotice!.summary!.soulsLifetime.toNumber()).toBe(5);
    store.getState().stopLoop();
  });

  it('uploads nothing when the slot could not be read', async () => {
    const local = saveState({ soulsLifetime: new Decimal(64), soulsRun: new Decimal(64) });
    const { store, cloud } = await make({ saved: local, cloud: { signedIn: true, failLoad: true } });
    await bootSynced(store, 'error');
    // A read that never landed is not an empty slot: nothing is written over what might be
    // a real run, and a passing blip raises no notice.
    expect(cloud.snapshot).toBeNull();
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(64);
    expect(store.getState().cloudNotice).toBeNull();
    store.getState().stopLoop();
  });

  it('reports a failed upload into an empty slot as an error', async () => {
    const { store } = await make({ cloud: { signedIn: true, failSave: true } });
    await bootSynced(store, 'error');
    store.getState().stopLoop();
  });

  it('still reports kept-local when the losing cloud copy could not be replaced', async () => {
    const local = saveState({ soulsLifetime: new Decimal(9_000), soulsRun: new Decimal(9_000) });
    const remote = saveState({ soulsLifetime: new Decimal(3), soulsRun: new Decimal(3), savedAtWall: T0 - 900 });
    const { store, cloud } = await make({
      saved: local,
      cloud: { signedIn: true, snapshot: snapshotOf(remote), failSave: true },
    });
    await bootSynced(store, 'kept-local');
    expect(cloud.snapshot!.data).toBe(snapshotOf(remote).data);
    expect(store.getState().cloudNotice!.kind).toBe('kept-local');
    store.getState().stopLoop();
  });

  it('carries onboarding progress with whichever save wins', async () => {
    const remote = saveState({
      soulsLifetime: new Decimal(4_000), soulsRun: new Decimal(4_000), savedAtWall: T0 - 1_000,
      onboarding: { memosSeen: true, trainingStep: 3 },
    });
    const { store } = await make({ cloud: { signedIn: true, snapshot: snapshotOf(remote) } });
    await bootSynced(store, 'downloaded');
    expect(store.getState().state.onboarding).toEqual({ memosSeen: true, trainingStep: 3 });
    store.getState().stopLoop();
  });
});

describe('cloud sign-in and overrides', () => {
  it('reports unavailable and syncs nothing where there is no cloud', async () => {
    const { store, cloud, services } = await make({ cloud: { available: false } });
    await store.getState().boot();
    expect(store.getState().cloud.available).toBe(false);
    expect(await store.getState().signInCloud()).toBe('unavailable');
    expect(cloud.signedIn).toBe(false);
    expect(services.calls).toEqual([]);
    expect(store.getState().cloud.lastResult).toBe('none');
    store.getState().stopLoop();
  });

  it('signs in, mirrors Play Games and syncs straight away', async () => {
    const { store, cloud, services } = await make({ cloud: { signedIn: false } });
    await store.getState().boot();
    expect(await store.getState().signInCloud()).toBe('ok');
    expect(store.getState().cloud.signedIn).toBe(true);
    expect(services.calls).toEqual(['signIn']);
    expect(cloud.snapshot).not.toBeNull();
    expect(store.getState().cloud.lastResult).toBe('uploaded');
    store.getState().stopLoop();
  });

  it('signInGameServices goes through the cloud sign-in when there is a cloud', async () => {
    const { store, cloud, services } = await make({ cloud: { signedIn: false } });
    await store.getState().boot();
    expect(await store.getState().signInGameServices()).toBe(true);
    expect(cloud.signedIn).toBe(true);
    expect(services.calls).toEqual(['signIn']);
    store.getState().stopLoop();
  });

  it('signInGameServices falls back to Play Games alone with no cloud', async () => {
    const { store, services } = await make({ cloud: { available: false } });
    await store.getState().boot();
    expect(await store.getState().signInGameServices()).toBe(true);
    expect(services.calls).toEqual(['signIn']);
    store.getState().stopLoop();
  });

  it('uploadLocal overwrites a richer cloud save', async () => {
    const local = saveState({ soulsLifetime: new Decimal(5), soulsRun: new Decimal(5) });
    const remote = saveState({ soulsLifetime: new Decimal(1e6), soulsRun: new Decimal(1e6), savedAtWall: T0 - 1_000 });
    const { store, cloud } = await make({ saved: local, cloud: { signedIn: true, snapshot: snapshotOf(remote) } });
    await store.getState().boot();
    expect(await store.getState().uploadLocal()).toBe('uploaded');
    expect(deserialize(cloud.snapshot!.data, content).soulsLifetime.toNumber()).toBe(5);
    expect(store.getState().state.cloud.lastResult).toBe('uploaded');
    // The player asked for this one, so it comes back with a receipt.
    expect(store.getState().cloudNotice!.kind).toBe('uploaded');
    store.getState().stopLoop();
  });

  it('labels the snapshot with the run it belongs to', async () => {
    const local = saveState({ soulsLifetime: new Decimal(12_345), soulsRun: new Decimal(12_345), fiscalYear: 4 });
    const { store, cloud } = await make({ saved: local, cloud: { signedIn: true } });
    const saves = vi.spyOn(cloud, 'save');
    await bootSynced(store, 'uploaded');
    expect(saves.mock.calls[0][1]).toBe('Souls: 12,345 · FY 4');
    saves.mockRestore();
    store.getState().stopLoop();
  });

  it('restoreCloud takes a poorer cloud save', async () => {
    const local = saveState({ soulsLifetime: new Decimal(1e6), soulsRun: new Decimal(1e6) });
    const remote = saveState({ soulsLifetime: new Decimal(7), soulsRun: new Decimal(7), savedAtWall: T0 - 1_000 });
    const { store } = await make({ saved: local, cloud: { signedIn: true, snapshot: snapshotOf(remote) } });
    await store.getState().boot();
    expect(await store.getState().restoreCloud()).toBe('downloaded');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(7);
    expect(store.getState().cloudNotice!.kind).toBe('downloaded');
    store.getState().stopLoop();
  });

  it('restoreCloud reports an empty slot without touching the local save', async () => {
    const local = saveState({ soulsLifetime: new Decimal(3), soulsRun: new Decimal(3) });
    const { store } = await make({ saved: local, cloud: { signedIn: true } });
    await store.getState().boot();
    expect(await store.getState().restoreCloud()).toBe('none');
    expect(store.getState().state.soulsLifetime.toNumber()).toBe(3);
    store.getState().stopLoop();
  });

  it('stamps an unavailable sync without touching the save', async () => {
    const { store } = await make({ cloud: { available: false } });
    await store.getState().boot();
    expect(await store.getState().syncCloud('manual')).toBe('unavailable');
    expect(store.getState().state.cloud.lastResult).toBe('unavailable');
    expect(store.getState().state.cloud.lastSyncWall).toBe(T0);
    expect(store.getState().cloud.syncing).toBe(false);
    store.getState().stopLoop();
  });

  it('a cloud call that throws does not wedge every later sync', async () => {
    const { store, cloud } = await make({ cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    cloud.snapshot = null;
    const broken = vi.spyOn(cloud, 'available').mockImplementationOnce(() => {
      throw new Error('the plugin is gone');
    });
    await expect(store.getState().syncCloud('manual')).resolves.toBe('unavailable');
    broken.mockRestore();
    expect(await store.getState().syncCloud('manual')).toBe('uploaded');
    expect(cloud.snapshot).not.toBeNull();
    store.getState().stopLoop();
  });

  it('runs one sync at a time', async () => {
    const { store, cloud } = await make({ cloud: { signedIn: true } });
    await store.getState().boot();
    const loads = vi.spyOn(cloud, 'load');
    const [a, b] = await Promise.all([store.getState().syncCloud('manual'), store.getState().syncCloud('auto')]);
    expect(a).toBe('uploaded');
    expect(b).toBe('uploaded');
    expect(loads).toHaveBeenCalledTimes(1);
    loads.mockRestore();
    store.getState().stopLoop();
  });
});

describe('cloud sync timing', () => {
  it('syncs on pause, after the local save', async () => {
    const { store, cloud } = await make({ cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    cloud.snapshot = null;
    await store.getState().pause();
    await vi.waitFor(() => expect(cloud.snapshot).not.toBeNull());
    store.getState().stopLoop();
  });

  it('a download that lands during pause leaves the office closed', async () => {
    vi.useFakeTimers();
    const local = saveState({ soulsLifetime: new Decimal(1), soulsRun: new Decimal(1) });
    const { store, cloud } = await make({ saved: local, cloud: { signedIn: true } });
    await bootSynced(store, 'uploaded');
    const other = saveState({ soulsLifetime: new Decimal(50_000), soulsRun: new Decimal(50_000), savedAtWall: T0 + 1 });
    cloud.snapshot = snapshotOf(other);
    await store.getState().pause();
    await vi.waitFor(() => expect(store.getState().state.soulsLifetime.toNumber()).toBe(50_000));
    // Neither the tick nor the autosave came back: only a resume reopens the office.
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('syncs on every fifth autosave', async () => {
    vi.useFakeTimers();
    const { store, cloud } = await make({ cloud: { signedIn: true }, autosaveMs: 1_000 });
    await bootSynced(store, 'uploaded');
    cloud.snapshot = null;
    await vi.advanceTimersByTimeAsync(4_000);
    expect(cloud.snapshot).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cloud.snapshot).not.toBeNull();
    store.getState().stopLoop();
    vi.useRealTimers();
  });
});

describe('onboarding progress', () => {
  it('stamping moves training past the first step, once', async () => {
    const { store } = await make();
    await store.getState().boot();
    expect(store.getState().state.onboarding.trainingStep).toBe(0);
    store.getState().stamp();
    expect(store.getState().state.onboarding.trainingStep).toBe(1);
    store.getState().stamp();
    expect(store.getState().state.onboarding.trainingStep).toBe(1);
    store.getState().stopLoop();
  });

  it('hiring moves training to the recap step', async () => {
    const { store } = await make();
    await store.getState().boot();
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(store.getState().state.staff.dave).toBe(1);
    expect(store.getState().state.onboarding.trainingStep).toBe(2);
    store.getState().stopLoop();
  });

  it('a hire that cannot be afforded does not move training on', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(store.getState().state.staff.dave).toBeUndefined();
    expect(store.getState().state.onboarding.trainingStep).toBe(1);
    store.getState().stopLoop();
  });

  it('advanceTraining only ever moves forward, and skipping finishes it', async () => {
    const { store } = await make();
    await store.getState().boot();
    store.getState().advanceTraining(2);
    expect(store.getState().state.onboarding.trainingStep).toBe(2);
    store.getState().advanceTraining(1);
    expect(store.getState().state.onboarding.trainingStep).toBe(2);
    store.getState().skipTraining();
    expect(store.getState().state.onboarding.trainingStep).toBe(3);
    store.getState().advanceTraining(0);
    expect(store.getState().state.onboarding.trainingStep).toBe(3);
    store.getState().stopLoop();
  });

  it('markMemosSeen records the first-launch memos', async () => {
    const { store, storage } = await make();
    await store.getState().boot();
    expect(store.getState().state.onboarding.memosSeen).toBe(false);
    store.getState().markMemosSeen();
    expect(store.getState().state.onboarding.memosSeen).toBe(true);
    store.getState().stopLoop();
    // Written straight away: a player who closes the app after reading them must not be
    // shown the same memos on the next launch.
    await vi.waitFor(async () =>
      expect(deserialize((await storage.get(SAVE_KEY))!, content).onboarding.memosSeen).toBe(true));
  });

  it('training progress reaches the save without waiting for the autosave', async () => {
    const { store, storage } = await make();
    await store.getState().boot();
    store.getState().skipTraining();
    store.getState().stopLoop();
    await vi.waitFor(async () =>
      expect(deserialize((await storage.get(SAVE_KEY))!, content).onboarding.trainingStep).toBe(3));
  });
});
