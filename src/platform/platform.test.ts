import { describe, it, expect, vi, afterEach } from 'vitest';
import { webAds, admobAds, pickAds, AD_PLACEMENTS } from './ads';
import { webBilling, revenueCatBilling, pickBilling, PRODUCT_IDS } from './billing';
import { noopGameServices, playGamesServices, pickGameServices } from './gameServices';
import { ADMOB_APP_ID, PRODUCTION_REWARDED_UNITS, TEST_REWARDED_UNIT, rewardedUnitId, isDevBuild } from './adUnits';
import { REVENUECAT_PLAY_KEY, REVENUECAT_TEST_KEY, revenueCatApiKey } from './billing';
import { LEADERBOARD_LIFETIME_SOULS, lifetimeSoulsLeaderboardId, playAchievementId, playAchievementIds } from './gameIds';

afterEach(() => {
  vi.useRealTimers();
});

describe('adUnits', () => {
  it('keeps the console app id and one production unit per placement', () => {
    expect(ADMOB_APP_ID).toBe('ca-app-pub-5130289288594607~4830589570');
    expect(PRODUCTION_REWARDED_UNITS).toEqual({
      'offline-double': 'ca-app-pub-5130289288594607/7233778673',
      'overtime-boost': 'ca-app-pub-5130289288594607/2737586738',
      'free-pull': 'ca-app-pub-5130289288594607/3254618178',
      'daily-skip': 'ca-app-pub-5130289288594607/8562785171',
    });
    expect(Object.keys(PRODUCTION_REWARDED_UNITS).sort()).toEqual([...AD_PLACEMENTS].sort());
  });

  it('uses distinct production units so per-placement revenue is attributable', () => {
    const units = Object.values(PRODUCTION_REWARDED_UNITS);
    expect(new Set(units).size).toBe(units.length);
  });

  it("uses Google's official rewarded test unit in dev and the real unit otherwise", () => {
    expect(TEST_REWARDED_UNIT).toBe('ca-app-pub-3940256099942544/5224354917');
    for (const p of AD_PLACEMENTS) {
      expect(rewardedUnitId(p, true)).toBe(TEST_REWARDED_UNIT);
      expect(rewardedUnitId(p, false)).toBe(PRODUCTION_REWARDED_UNITS[p]);
    }
  });

  it('defaults to a test unit outside a production build', () => {
    expect(isDevBuild()).toBe(true);
    expect(rewardedUnitId('free-pull')).toBe(TEST_REWARDED_UNIT);
  });
});

describe('billing keys', () => {
  it('uses the Test Store key in dev and the Play key in production', () => {
    expect(revenueCatApiKey(true)).toBe(REVENUECAT_TEST_KEY);
    expect(revenueCatApiKey(false)).toBe(REVENUECAT_PLAY_KEY);
    expect(REVENUECAT_TEST_KEY.startsWith('test_')).toBe(true);
    expect(REVENUECAT_PLAY_KEY.startsWith('goog_')).toBe(true);
  });
});

describe('gameIds', () => {
  it('resolves mapped ids and drops unmapped ones rather than sending placeholders to the SDK', () => {
    expect(LEADERBOARD_LIFETIME_SOULS).toMatch(/^CgkI/);
    expect(lifetimeSoulsLeaderboardId()).toBe(LEADERBOARD_LIFETIME_SOULS);
    expect(playAchievementId('a-souls-1')).toMatch(/^CgkI/);
    expect(playAchievementId('a-clicks-1')).toBeNull(); // in-app only, not mirrored
    expect(playAchievementId('does-not-exist')).toBeNull();
    expect(playAchievementIds(['a-souls-1', 'a-clicks-1'])).toEqual([playAchievementId('a-souls-1')]);
  });
});

describe('webAds', () => {
  it('initialises and reports ready', async () => {
    await expect(webAds.init()).resolves.toBeUndefined();
    expect(webAds.isReady()).toBe(true);
  });

  it('resolves rewarded after 300 ms, not before', async () => {
    vi.useFakeTimers();
    let settled: string | undefined;
    const p = webAds.showRewarded('free-pull').then((r) => (settled = r));
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe('rewarded');
  });

  it('rewards every placement', async () => {
    vi.useFakeTimers();
    for (const p of AD_PLACEMENTS) {
      const pending = webAds.showRewarded(p);
      await vi.advanceTimersByTimeAsync(300);
      expect(await pending).toBe('rewarded');
    }
  });
});

describe('webBilling', () => {
  it('lists one mock product per id with a price and a title', async () => {
    const products = await webBilling.products();
    expect(products.map((p) => p.id).sort()).toEqual([...PRODUCT_IDS].sort());
    for (const p of products) {
      expect(p.price).toMatch(/^\$\d+\.\d{2}$/);
      expect(p.title.length).toBeGreaterThan(0);
    }
  });

  it('resolves purchase with ok after 300 ms, not before', async () => {
    vi.useFakeTimers();
    let settled: string | undefined;
    const p = webBilling.purchase('vouchers_10').then((r) => (settled = r));
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe('ok');
  });

  it('restores and syncs nothing', async () => {
    await expect(webBilling.init()).resolves.toBeUndefined();
    const nothing = { removeAds: false, unionUntilWall: 0, starterPackBought: false };
    expect(await webBilling.restore()).toEqual(nothing);
    // The store's merge only ever adds, so "nothing" leaves the local entitlements standing.
    expect(await webBilling.sync()).toEqual(nothing);
  });
});

describe('web fallbacks in a production build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('grants no rewarded ad', async () => {
    vi.stubEnv('DEV', false);
    expect(isDevBuild()).toBe(false);
    for (const p of AD_PLACEMENTS) {
      // No timers involved: there is no ad network behind a web build, so it resolves at once.
      expect(await webAds.showRewarded(p)).toBe('unavailable');
    }
  });

  it('completes no purchase', async () => {
    vi.stubEnv('DEV', false);
    expect(await webBilling.purchase('vouchers_10')).toBe('error');
    expect(await webBilling.purchase('remove_ads')).toBe('error');
  });

  it('still grants in a development build, so the browser build stays playable', async () => {
    vi.useFakeTimers();
    expect(isDevBuild()).toBe(true);
    const ad = webAds.showRewarded('free-pull');
    const buy = webBilling.purchase('vouchers_10');
    await vi.advanceTimersByTimeAsync(300);
    expect(await ad).toBe('rewarded');
    expect(await buy).toBe('ok');
  });
});

describe('noopGameServices', () => {
  it('never signs in and swallows achievement and score calls', async () => {
    expect(await noopGameServices.signIn()).toBe(false);
    expect(noopGameServices.isSignedIn()).toBe(false);
    await expect(noopGameServices.unlockAchievements(['a', 'b'])).resolves.toBeUndefined();
    await expect(noopGameServices.submitScore('lifetime-souls', 42)).resolves.toBeUndefined();
  });
});

describe('pick*', () => {
  it('returns the web implementations under jsdom', () => {
    expect(pickAds()).toBe(webAds);
    expect(pickBilling()).toBe(webBilling);
    expect(pickGameServices()).toBe(noopGameServices);
  });

  it('still exposes the native implementations for native builds', () => {
    expect(pickAds()).not.toBe(admobAds);
    expect(pickBilling()).not.toBe(revenueCatBilling);
    expect(pickGameServices()).not.toBe(playGamesServices);
  });
});
