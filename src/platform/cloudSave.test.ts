import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `@capacitor/core` is stubbed for the whole file: `registerPlugin` hands back a fake native
 * plugin whose four methods the tests drive, and `Capacitor` reports whatever platform the
 * test under way needs. That is the only way to exercise `playCloudSave` under jsdom.
 */
const cap = vi.hoisted(() => ({
  native: false,
  platform: 'web',
  plugin: {
    isAuthenticated: vi.fn(),
    signIn: vi.fn(),
    loadSnapshot: vi.fn(),
    saveSnapshot: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    getPlatform: () => cap.platform,
  },
  registerPlugin: () => cap.plugin,
}));

import { memoryCloudSave, noopCloudSave, playCloudSave, pickCloudSave, SNAPSHOT_NAME } from './cloudSave';
import type { CloudSnapshot } from './cloudSave';

const snap = (data: string, savedAtWall: number): CloudSnapshot => ({ data, savedAtWall });

function onAndroid(): void {
  cap.native = true;
  cap.platform = 'android';
}

beforeEach(() => {
  cap.native = false;
  cap.platform = 'web';
  cap.plugin.isAuthenticated.mockReset();
  cap.plugin.signIn.mockReset();
  cap.plugin.loadSnapshot.mockReset();
  cap.plugin.saveSnapshot.mockReset();
});

describe('memoryCloudSave', () => {
  it('round-trips a snapshot once signed in', async () => {
    const fake = memoryCloudSave();

    expect(fake.available()).toBe(true);
    expect(await fake.isSignedIn()).toBe(false);
    expect(await fake.signIn()).toBe('ok');
    expect(fake.signedIn).toBe(true);
    expect(await fake.isSignedIn()).toBe(true);

    expect(await fake.load()).toBeNull();
    expect(await fake.save(snap('payload', 1000), 'Fiscal year 3')).toBe('ok');
    expect(await fake.load()).toEqual(snap('payload', 1000));
    expect(fake.snapshot).toEqual(snap('payload', 1000));
  });

  it('serves a preloaded snapshot and can start already signed in', async () => {
    const fake = memoryCloudSave({ signedIn: true, snapshot: snap('cloud', 42) });

    expect(await fake.isSignedIn()).toBe(true);
    expect(await fake.load()).toEqual(snap('cloud', 42));
  });

  it('reports an error and keeps the old snapshot when failSave is set', async () => {
    const fake = memoryCloudSave({ signedIn: true, snapshot: snap('old', 1), failSave: true });

    expect(await fake.save(snap('new', 2), 'nope')).toBe('error');
    expect(fake.snapshot).toEqual(snap('old', 1));
    expect(await fake.load()).toEqual(snap('old', 1));
  });

  it('refuses everything when it is not available', async () => {
    const fake = memoryCloudSave({ available: false, snapshot: snap('cloud', 7) });

    expect(fake.available()).toBe(false);
    expect(await fake.signIn()).toBe('unavailable');
    expect(fake.signedIn).toBe(false);
    expect(await fake.isSignedIn()).toBe(false);
    expect(await fake.load()).toBeNull();
    expect(await fake.save(snap('x', 8), 'x')).toBe('error');
  });

  it('refuses load and save while signed out', async () => {
    const fake = memoryCloudSave({ snapshot: snap('cloud', 7) });

    expect(await fake.load()).toBeNull();
    expect(await fake.save(snap('x', 8), 'x')).toBe('error');
  });
});

describe('noopCloudSave', () => {
  it('is unavailable and every call is inert', async () => {
    expect(noopCloudSave.available()).toBe(false);
    expect(await noopCloudSave.isSignedIn()).toBe(false);
    expect(await noopCloudSave.signIn()).toBe('unavailable');
    expect(await noopCloudSave.load()).toBeNull();
    expect(await noopCloudSave.save(snap('x', 1), 'x')).toBe('error');
  });
});

describe('playCloudSave', () => {
  it('is available only on a native Android build', () => {
    expect(playCloudSave.available()).toBe(false);

    cap.native = true;
    cap.platform = 'ios';
    expect(playCloudSave.available()).toBe(false);

    onAndroid();
    expect(playCloudSave.available()).toBe(true);
  });

  it('reports the plugin sign-in state, and false when the plugin fails', async () => {
    onAndroid();

    cap.plugin.isAuthenticated.mockResolvedValue({ value: true });
    expect(await playCloudSave.isSignedIn()).toBe(true);

    cap.plugin.isAuthenticated.mockResolvedValue({ value: false });
    expect(await playCloudSave.isSignedIn()).toBe(false);

    cap.plugin.isAuthenticated.mockRejectedValue(new Error('no play games'));
    expect(await playCloudSave.isSignedIn()).toBe(false);
  });

  it('maps a declined sign-in to cancelled and a broken plugin to unavailable', async () => {
    onAndroid();

    cap.plugin.signIn.mockResolvedValue({ value: true });
    expect(await playCloudSave.signIn()).toBe('ok');

    cap.plugin.signIn.mockResolvedValue({ value: false });
    expect(await playCloudSave.signIn()).toBe('cancelled');

    cap.plugin.signIn.mockRejectedValue(new Error('not implemented'));
    expect(await playCloudSave.signIn()).toBe('unavailable');
  });

  it('loads a snapshot, and returns null when there is none or the call fails', async () => {
    onAndroid();

    cap.plugin.loadSnapshot.mockResolvedValue({ found: true, data: 'payload', savedAtWall: 1234 });
    expect(await playCloudSave.load()).toEqual(snap('payload', 1234));
    expect(cap.plugin.loadSnapshot).toHaveBeenCalledWith({ name: SNAPSHOT_NAME });

    cap.plugin.loadSnapshot.mockResolvedValue({ found: false });
    expect(await playCloudSave.load()).toBeNull();

    cap.plugin.loadSnapshot.mockRejectedValue(new Error('open failed'));
    expect(await playCloudSave.load()).toBeNull();
  });

  it('treats a found snapshot with a missing timestamp as saved at zero', async () => {
    onAndroid();
    cap.plugin.loadSnapshot.mockResolvedValue({ found: true, data: 'payload' });

    expect(await playCloudSave.load()).toEqual(snap('payload', 0));
  });

  it('saves through the plugin and maps a throw to error', async () => {
    onAndroid();

    cap.plugin.saveSnapshot.mockResolvedValue(undefined);
    expect(await playCloudSave.save(snap('payload', 99), 'Fiscal year 3')).toBe('ok');
    expect(cap.plugin.saveSnapshot).toHaveBeenCalledWith({
      name: SNAPSHOT_NAME,
      data: 'payload',
      description: 'Fiscal year 3',
      savedAtWall: 99,
    });

    cap.plugin.saveSnapshot.mockRejectedValue(new Error('commit failed'));
    expect(await playCloudSave.save(snap('payload', 99), 'Fiscal year 3')).toBe('error');
  });
});

describe('pickCloudSave', () => {
  it('picks the Play implementation on Android and the no-op everywhere else', () => {
    expect(pickCloudSave()).toBe(noopCloudSave);

    cap.native = true;
    cap.platform = 'ios';
    expect(pickCloudSave()).toBe(noopCloudSave);

    onAndroid();
    expect(pickCloudSave()).toBe(playCloudSave);
  });
});
