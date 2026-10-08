import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * iOS matches Android: AdMob with the iOS app's own units, RevenueCat keyed by a build-time
 * env var, and Game Center through the same plugin as Play Games. `@capacitor/core` is stubbed so `Capacitor.getPlatform()` can report 'ios'
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

import { pickAds, admobAds } from './ads';
import { rewardedUnitId, PRODUCTION_REWARDED_UNITS_IOS, TEST_REWARDED_UNIT_IOS } from './adUnits';
import { playAchievementId, lifetimeSoulsLeaderboardId, eventLeaderboardId } from './gameIds';
import { pickBilling, storeProductId, revenueCatApiKey, revenueCatBilling, REVENUECAT_PLAY_KEY } from './billing';
import { pickGameServices, noopGameServices } from './gameServices';

beforeEach(() => {
  cap.native = true;
  cap.platform = 'ios';
});

describe('iOS platform behaviour', () => {
  it('shows AdMob ads from the iOS app units', () => {
    expect(pickAds()).toBe(admobAds);
    expect(rewardedUnitId('free-pull', false)).toBe(PRODUCTION_REWARDED_UNITS_IOS['free-pull']);
    expect(rewardedUnitId('free-pull', true)).toBe(TEST_REWARDED_UNIT_IOS);
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
    expect(storeProductId('remove_ads')).toBe('remove_ads_v2');
    expect(storeProductId('starter_pack')).toBe('starter_pack');
    expect(storeProductId('remove_ads', 'android')).toBe('remove_ads');
  });

  it('uses Game Center with derived ids', () => {
    expect(pickGameServices()).not.toBe(noopGameServices);
    expect(playAchievementId('a-souls-1')).toBe('ab.a_souls_1');
    expect(playAchievementId('not-mirrored')).toBeNull();
    expect(lifetimeSoulsLeaderboardId()).toBe('ab.lifetime_souls');
    expect(eventLeaderboardId({ kind: 'weekly', id: 'w1' })).toBe('ab.event_weekly');
    expect(eventLeaderboardId({ kind: 'special', id: 'halloween' })).toBe('ab.event_halloween');
  });
});

describe('Android is unaffected', () => {
  beforeEach(() => {
    cap.platform = 'android';
  });

  it('keeps ads, the Play billing key, and Play Games on Android', () => {
    expect(pickAds()).toBe(admobAds);
    expect(revenueCatApiKey(false)).toBe(REVENUECAT_PLAY_KEY);
    expect(pickGameServices()).not.toBe(noopGameServices);
  });
});
