import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * iOS v1: no AdMob pod, no AdMob iOS app, RevenueCat keyed by a build-time env var, and no
 * Game Center. `@capacitor/core` is stubbed so `Capacitor.getPlatform()` can report 'ios'
 * without a real native runtime under jsdom.
 */
const cap = vi.hoisted(() => ({ native: true, platform: 'ios' }));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => cap.native, getPlatform: () => cap.platform },
  };
});

import { adsSupported, pickAds, noAds } from './ads';
import { pickBilling, revenueCatApiKey, revenueCatBilling, REVENUECAT_PLAY_KEY } from './billing';
import { pickGameServices, noopGameServices } from './gameServices';

beforeEach(() => {
  cap.native = true;
  cap.platform = 'ios';
});

describe('iOS platform behaviour', () => {
  it('has no ad network: adsSupported is false and pickAds returns the no-op', () => {
    expect(adsSupported()).toBe(false);
    expect(pickAds()).toBe(noAds);
  });

  it('noAds never rewards and reports never-ready', async () => {
    await expect(noAds.init()).resolves.toBeUndefined();
    expect(noAds.isReady()).toBe(false);
    await expect(noAds.showRewarded('free-pull')).resolves.toBe('unavailable');
  });

  it('uses the RevenueCat iOS env key in production, not the Play key', () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'appl_test_key');
    expect(revenueCatApiKey(false)).toBe('appl_test_key');
    expect(revenueCatApiKey(false)).not.toBe(REVENUECAT_PLAY_KEY);
    vi.unstubAllEnvs();
  });

  it('degrades to unconfigured (no crash) when the iOS key is empty', async () => {
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', '');
    expect(revenueCatApiKey(false)).toBe('');
    await expect(revenueCatBilling.init()).resolves.toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('still uses RevenueCat as the native billing backend on iOS', () => {
    expect(pickBilling()).toBe(revenueCatBilling);
  });

  it('has no Game Center: pickGameServices returns the no-op', () => {
    expect(pickGameServices()).toBe(noopGameServices);
  });
});

describe('Android is unaffected', () => {
  beforeEach(() => {
    cap.platform = 'android';
  });

  it('keeps ads, the Play billing key, and Play Games on Android', () => {
    expect(adsSupported()).toBe(true);
    expect(revenueCatApiKey(false)).toBe(REVENUECAT_PLAY_KEY);
    expect(pickGameServices()).not.toBe(noopGameServices);
  });
});
