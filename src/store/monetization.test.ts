import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { computeRates } from '../engine/economy';
import { serialize, type GameState } from '../engine/state';
import { encodeSave } from '../platform/saveCode';
import { PLAY_ACHIEVEMENT_IDS } from '../platform/gameIds';
import type { Ads, AdPlacement, AdResult } from '../platform/ads';
import type { Billing, Product, ProductId, PurchaseResult, Restored } from '../platform/billing';
import type { GameServices } from '../platform/gameServices';
import {
  STARTER_PACK_CARD,
  STARTER_PACK_KC_SECONDS,
  STARTER_PACK_VOUCHERS,
  STARTER_PACK_WINDOW_MS,
  UNION_GLOBAL_MULT,
  UNION_PERIOD_MS,
  UNION_ROLLOVER_VOUCHERS,
} from '../engine/entitlements';
import { BOOST_AD_COOLDOWN_MS, BOOST_AD_DURATION_MS, lifetimeSoulsScore } from './game';

/** The leaderboard id is still a console placeholder, so the store's call is stubbed to a real one. */
vi.mock('../platform/gameIds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../platform/gameIds')>();
  return { ...actual, lifetimeSoulsLeaderboardId: () => 'lb-lifetime-souls' };
});

function fakeAds() {
  const shown: AdPlacement[] = [];
  let ready = true;
  let result: AdResult = 'rewarded';
  const ads: Ads = {
    async init() {},
    isReady: () => ready,
    async showRewarded(placement) {
      shown.push(placement);
      return result;
    },
  };
  return {
    ads,
    shown,
    setReady: (v: boolean) => { ready = v; },
    setResult: (r: AdResult) => { result = r; },
  };
}

function fakeBilling() {
  const bought: ProductId[] = [];
  let result: PurchaseResult = 'ok';
  let restored: Restored = { removeAds: false, unionUntilWall: 0, starterPackBought: false };
  const catalogue: Product[] = [{ id: 'vouchers_10', price: '$0.99', title: '10 Overtime Vouchers' }];
  const billing: Billing = {
    async init() {},
    async products() { return catalogue; },
    async purchase(id) {
      bought.push(id);
      return result;
    },
    async restore() { return restored; },
  };
  return {
    billing,
    bought,
    catalogue,
    setResult: (r: PurchaseResult) => { result = r; },
    setRestored: (r: Restored) => { restored = r; },
  };
}

function fakeServices() {
  const unlocked: string[][] = [];
  const scores: Array<[string, number]> = [];
  let signedIn = false;
  const services: GameServices = {
    async signIn() { signedIn = true; return true; },
    isSignedIn: () => signedIn,
    async unlockAchievements(ids) { unlocked.push(ids); },
    async submitScore(leaderboardId, value) { scores.push([leaderboardId, value]); },
  };
  return { services, unlocked, scores };
}

const T0 = new Date(2026, 8, 14, 10).getTime();

async function make(wall = T0) {
  const storage = memoryStorage();
  const clock = fakeClock({ wall, mono: 0 });
  const ads = fakeAds();
  const billing = fakeBilling();
  const services = fakeServices();
  const store = createGameStore({
    content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000,
    ads: ads.ads, billing: billing.billing, gameServices: services.services,
  });
  await store.getState().boot();
  /** State and rates move together, so a seeded state never leaves stale rates behind. */
  const seed = (patch: Partial<GameState>) => {
    const state = { ...store.getState().state, ...patch };
    store.setState({ state, rates: computeRates(state, content, clock.wall()) });
    return state;
  };
  const union = (untilMs = UNION_PERIOD_MS) => {
    const s = store.getState().state;
    return seed({ entitlements: { ...s.entitlements, unionUntilWall: clock.wall() + untilMs } });
  };
  return { store, storage, clock, ads, billing, services, seed, union };
}

describe('rewarded ads', () => {
  it('boot reports ad readiness and the billing catalogue', async () => {
    const { store, billing } = await make();
    expect(store.getState().adsReady).toBe(true);
    await vi.waitFor(() => expect(store.getState().products).toEqual(billing.catalogue));
    store.getState().stopLoop();
  });

  it('offline-double credits the backlog a second time and counts the ad', async () => {
    const { store, clock, seed } = await make();
    seed({ staff: { dave: 20 } });
    await store.getState().pause();
    clock.advance(3600_000);
    await store.getState().resume();
    const pending = store.getState().pendingOffline!;
    expect(pending.souls.gt(0)).toBe(true);
    const before = store.getState().state.soulsLifetime;
    expect(store.getState().canWatch('offline-double')).toBe(true);
    expect(await store.getState().watchAd('offline-double')).toBe('rewarded');
    expect(store.getState().state.soulsLifetime.sub(before).eq(pending.souls)).toBe(true);
    expect(store.getState().pendingOffline).toBeNull();
    expect(store.getState().state.stats.adsWatched).toBe(1);
    // Nothing left to double.
    expect(store.getState().canWatch('offline-double')).toBe(false);
    store.getState().stopLoop();
  });

  it('overtime-boost runs for four hours and locks the placement for eight', async () => {
    const { store, clock } = await make();
    expect(store.getState().canWatch('overtime-boost')).toBe(true);
    expect(await store.getState().watchAd('overtime-boost')).toBe('rewarded');
    const s = store.getState().state;
    expect(s.boostUntilWall).toBe(clock.wall() + BOOST_AD_DURATION_MS);
    expect(s.adState.boostCooldownUntilWall).toBe(clock.wall() + BOOST_AD_COOLDOWN_MS);
    expect(BOOST_AD_DURATION_MS).toBe(4 * 3600_000);
    expect(BOOST_AD_COOLDOWN_MS).toBe(8 * 3600_000);
    expect(store.getState().canWatch('overtime-boost')).toBe(false);
    // Still on cooldown when the boost itself has run out.
    clock.advance(BOOST_AD_DURATION_MS);
    expect(store.getState().canWatch('overtime-boost')).toBe(false);
    clock.advance(BOOST_AD_COOLDOWN_MS - BOOST_AD_DURATION_MS);
    expect(store.getState().canWatch('overtime-boost')).toBe(true);
    store.getState().stopLoop();
  });

  it('free-pull draws one card without spending a voucher, once a local day', async () => {
    const { store, clock, seed } = await make();
    seed({ vouchers: 0 });
    expect(store.getState().canWatch('free-pull')).toBe(true);
    expect(await store.getState().watchAd('free-pull')).toBe('rewarded');
    expect(store.getState().pendingPull).toHaveLength(1);
    expect(store.getState().state.vouchers).toBe(0);
    expect(store.getState().state.stats.pulls).toBe(1);
    expect(store.getState().canWatch('free-pull')).toBe(false);
    expect(await store.getState().watchAd('free-pull')).toBe('unavailable');
    expect(store.getState().state.stats.pulls).toBe(1);
    // A new local day refills it.
    clock.advance(86_400_000);
    expect(store.getState().canWatch('free-pull')).toBe(true);
    store.getState().stopLoop();
  });

  it('daily-skip marks one task done without spending a skip token, once a local day', async () => {
    const { store, clock, seed } = await make();
    seed({ dailies: { ...store.getState().state.dailies, skipTokens: 0 } });
    const [first, second] = store.getState().state.dailies.tasks.map((t) => t.id);
    expect(store.getState().canWatch('daily-skip')).toBe(true);
    expect(await store.getState().watchAd('daily-skip', first)).toBe('rewarded');
    expect(store.getState().state.dailies.skipped).toEqual([first]);
    expect(store.getState().state.dailies.skipTokens).toBe(0);
    expect(store.getState().canWatch('daily-skip')).toBe(false);
    expect(await store.getState().watchAd('daily-skip', second)).toBe('unavailable');
    expect(store.getState().state.dailies.skipped).toEqual([first]);
    clock.advance(86_400_000);
    expect(store.getState().canWatch('daily-skip')).toBe(true);
    store.getState().stopLoop();
  });

  it('refuses every placement when the ad SDK is not ready', async () => {
    const { store, ads } = await make();
    ads.setReady(false);
    store.setState({ adsReady: false });
    for (const p of ['offline-double', 'overtime-boost', 'free-pull', 'daily-skip'] as AdPlacement[]) {
      expect(store.getState().canWatch(p), p).toBe(false);
      expect(await store.getState().watchAd(p, 'x'), p).toBe('unavailable');
    }
    expect(ads.shown).toEqual([]);
    store.getState().stopLoop();
  });

  it('pays nothing when the player dismisses the ad', async () => {
    const { store, ads } = await make();
    ads.setResult('dismissed');
    expect(await store.getState().watchAd('overtime-boost')).toBe('dismissed');
    expect(store.getState().state.boostUntilWall).toBe(0);
    expect(store.getState().state.adState.boostCooldownUntilWall).toBe(0);
    expect(store.getState().state.stats.adsWatched).toBe(0);
    store.getState().stopLoop();
  });

  it('survives an ad SDK that throws', async () => {
    const storage = memoryStorage();
    const clock = fakeClock({ wall: T0, mono: 0 });
    const ads: Ads = { async init() {}, isReady: () => true, async showRewarded() { throw new Error('no fill'); } };
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000, ads });
    await store.getState().boot();
    await expect(store.getState().watchAd('overtime-boost')).resolves.toBe('unavailable');
    expect(store.getState().state.stats.adsWatched).toBe(0);
    store.getState().stopLoop();
  });
});

describe('purchases', () => {
  it('grants each product exactly and counts the purchase', async () => {
    const { store, billing, seed } = await make();
    seed({ perks: ['requisition-1'], staff: { dave: 20 } });
    expect(await store.getState().buy('vouchers_55')).toBe('ok');
    expect(billing.bought).toEqual(['vouchers_55']);
    expect(store.getState().state.vouchers).toBe(55);
    expect(store.getState().state.stats.purchases).toBe(1);

    expect(await store.getState().buy('remove_ads')).toBe('ok');
    expect(store.getState().state.entitlements.removeAds).toBe(true);

    const kcBefore = store.getState().state.kc;
    const kcPerSec = store.getState().rates.kcPerSec;
    expect(await store.getState().buy('starter_pack')).toBe('ok');
    const afterPack = store.getState().state;
    expect(afterPack.vouchers).toBe(55 + STARTER_PACK_VOUCHERS);
    expect(afterPack.cards[STARTER_PACK_CARD]).toBe(1);
    expect(afterPack.kc.sub(kcBefore).eq(kcPerSec.mul(STARTER_PACK_KC_SECONDS))).toBe(true);

    expect(await store.getState().buy('union_monthly')).toBe('ok');
    expect(store.getState().state.entitlements.unionUntilWall).toBe(T0 + UNION_PERIOD_MS);
    expect(store.getState().state.stats.purchases).toBe(4);
    expect(store.getState().purchasePending).toBeNull();
    store.getState().stopLoop();
  });

  it('grants nothing when the purchase is cancelled or fails', async () => {
    const { store, billing } = await make();
    billing.setResult('cancelled');
    expect(await store.getState().buy('vouchers_10')).toBe('cancelled');
    billing.setResult('error');
    expect(await store.getState().buy('vouchers_10')).toBe('error');
    expect(store.getState().state.vouchers).toBe(0);
    expect(store.getState().state.stats.purchases).toBe(0);
    expect(store.getState().purchasePending).toBeNull();
    store.getState().stopLoop();
  });

  it('refuses the starter pack outside its three-day window and after it is bought', async () => {
    const { store, billing, clock } = await make();
    expect(await store.getState().buy('starter_pack')).toBe('ok');
    expect(store.getState().state.entitlements.starterPackBought).toBe(true);
    // Already owned: never billed twice.
    expect(await store.getState().buy('starter_pack')).toBe('error');
    expect(billing.bought).toEqual(['starter_pack']);
    expect(store.getState().state.vouchers).toBe(STARTER_PACK_VOUCHERS);

    const late = await make();
    late.clock.advance(STARTER_PACK_WINDOW_MS + 1);
    expect(await late.store.getState().buy('starter_pack')).toBe('error');
    expect(late.billing.bought).toEqual([]);
    clock.advance(0);
    store.getState().stopLoop();
    late.store.getState().stopLoop();
  });

  it('restores entitlements without downgrading the ones already held', async () => {
    const { store, billing, seed } = await make();
    seed({ entitlements: { removeAds: true, unionUntilWall: T0 + 10_000, starterPackBought: false } });
    billing.setRestored({ removeAds: false, unionUntilWall: T0 + 5_000, starterPackBought: true });
    await store.getState().restorePurchases();
    expect(store.getState().state.entitlements).toEqual({
      removeAds: true,
      unionUntilWall: T0 + 10_000,
      starterPackBought: true,
    });
    store.getState().stopLoop();
  });
});

describe('union membership in the store', () => {
  it('multiplies income by 1.25 while active', async () => {
    const { store, seed, union } = await make();
    seed({ staff: { dave: 25 } });
    const plain = store.getState().rates.soulsPerSec;
    union();
    const member = store.getState().rates.soulsPerSec;
    expect(member.div(plain).toNumber()).toBeCloseTo(UNION_GLOBAL_MULT, 9);
    store.getState().stopLoop();
  });

  it('grants two vouchers on every daily rollover while active', async () => {
    const { store, clock, seed, union } = await make();
    seed({ vouchers: 0, perks: ['requisition-1'] });
    union(3 * 86_400_000);
    clock.advance(86_400_000);
    store.getState().stamp();
    // Exact: the requisition perk never multiplies a membership grant.
    expect(store.getState().state.vouchers).toBe(UNION_ROLLOVER_VOUCHERS);
    store.getState().stopLoop();
  });

  it('auto-claims finished dailies while active', async () => {
    const { store, seed, union } = await make();
    const s = store.getState().state;
    const def = content.dailies.find((d) => d.id === 'd-clicks-1')!;
    seed({
      vouchers: 0,
      dailies: { ...s.dailies, tasks: [{ id: def.id, claimed: false }], baseline: { ...s.dailies.baseline, clicks: 0 } },
      stats: { ...s.stats, clicks: def.target },
    });
    expect(store.getState().state.dailies.tasks[0].claimed).toBe(false);
    union();
    store.getState().stamp();
    const after = store.getState().state;
    expect(after.dailies.tasks[0].claimed).toBe(true);
    expect(after.stats.dailiesClaimed).toBe(1);
    expect(after.vouchers).toBe(1);
    store.getState().stopLoop();
  });

  it('leaves finished dailies for the player to claim without a membership', async () => {
    const { store, seed } = await make();
    const s = store.getState().state;
    const def = content.dailies.find((d) => d.id === 'd-clicks-1')!;
    seed({
      dailies: { ...s.dailies, tasks: [{ id: def.id, claimed: false }], baseline: { ...s.dailies.baseline, clicks: 0 } },
      stats: { ...s.stats, clicks: def.target },
    });
    store.getState().stamp();
    expect(store.getState().state.dailies.tasks[0].claimed).toBe(false);
    store.getState().stopLoop();
  });
});

describe('cosmic restructuring in the store', () => {
  it('files a Cosmic, records the ceremony and clears it on dismiss', async () => {
    const { store, seed } = await make();
    seed({ seals: 150, perks: ['throughput-1'], soulsRun: new Decimal('1e9'), fiscalYear: 4 });
    store.getState().cosmic();
    const s = store.getState().state;
    expect(store.getState().lastCosmic).toEqual({ pointsGained: 1 });
    expect(s.seals).toBe(0);
    expect(s.perks).toEqual([]);
    expect(s.cosmicPoints).toBe(1);
    expect(s.stats.cosmics).toBe(1);
    expect(s.fiscalYear).toBe(4);
    expect(s.soulsRun.toNumber()).toBe(0);
    store.getState().dismissCosmic();
    expect(store.getState().lastCosmic).toBeNull();
    store.getState().stopLoop();
  });

  it('refuses a Cosmic below the Seal threshold', async () => {
    const { store, seed } = await make();
    seed({ seals: 99 });
    store.getState().cosmic();
    expect(store.getState().lastCosmic).toBeNull();
    expect(store.getState().state.seals).toBe(99);
    store.getState().stopLoop();
  });

  it('buys a Clause with a Cosmic Point and applies its effect', async () => {
    const { store, seed } = await make();
    seed({ cosmicPoints: 1, staff: { dave: 20 } });
    const before = store.getState().rates.soulsPerSec;
    store.getState().buyClause('clause-throughput-1');
    expect(store.getState().state.cosmicClauses).toEqual(['clause-throughput-1']);
    expect(store.getState().state.cosmicPoints).toBe(0);
    expect(store.getState().rates.soulsPerSec.div(before).toNumber()).toBeCloseTo(1.5, 9);
    // No points left: a second Clause is refused.
    store.getState().buyClause('clause-seals-1');
    expect(store.getState().state.cosmicClauses).toEqual(['clause-throughput-1']);
    store.getState().stopLoop();
  });
});

describe('game services and the save code', () => {
  it('mirrors newly unlocked achievements to Play Games', async () => {
    const { store, services, seed } = await make();
    PLAY_ACHIEVEMENT_IDS['a-souls-1'] = 'CgkITEST';
    try {
      seed({ soulsLifetime: new Decimal(999) });
      store.getState().stamp();
      expect(store.getState().state.achievements).toContain('a-souls-1');
      expect(services.unlocked).toEqual([['CgkITEST']]);
      // Nothing new to mirror on the next settle.
      store.getState().stamp();
      expect(services.unlocked).toEqual([['CgkITEST']]);
    } finally {
      delete PLAY_ACHIEVEMENT_IDS['a-souls-1'];
    }
    store.getState().stopLoop();
  });

  it('submits the lifetime-souls score on an audit', async () => {
    const { store, services, seed } = await make();
    seed({ soulsRun: new Decimal('1e13'), soulsLifetime: new Decimal('1e12') });
    store.getState().audit();
    expect(services.scores).toEqual([['lb-lifetime-souls', 12_000]]);
    // Orders of magnitude, so a score always fits a 64-bit leaderboard.
    expect(lifetimeSoulsScore(new Decimal('1e120'))).toBe(120_000);
    expect(lifetimeSoulsScore(new Decimal(0))).toBe(0);
    store.getState().stopLoop();
  });

  it('signs in through the platform layer', async () => {
    const { store, services } = await make();
    expect(services.services.isSignedIn()).toBe(false);
    expect(await store.getState().signInGameServices()).toBe(true);
    expect(services.services.isSignedIn()).toBe(true);
    store.getState().stopLoop();
  });

  it('exports a save code and imports it back', async () => {
    const { store, seed } = await make();
    seed({ vouchers: 7, seals: 3 });
    const code = store.getState().exportSaveCode();
    seed({ vouchers: 0, seals: 0 });
    expect(await store.getState().importSaveCode(code)).toBe('ok');
    expect(store.getState().state.vouchers).toBe(7);
    expect(store.getState().state.seals).toBe(3);
    store.getState().stopLoop();
  });

  it('leaves the current save untouched when the code is invalid', async () => {
    const { store, storage, seed } = await make();
    seed({ vouchers: 11 });
    await store.getState().save();
    const saved = await storage.get(SAVE_KEY);
    for (const bad of ['', 'nonsense', 'AB1.notbase64!.0000000a', encodeSave(serialize(store.getState().state)).slice(0, -1)]) {
      expect(await store.getState().importSaveCode(bad), bad).toBe('invalid');
      expect(store.getState().state.vouchers).toBe(11);
    }
    expect(await storage.get(SAVE_KEY)).toBe(saved);
    store.getState().stopLoop();
  });

  it('imports a code from another device without inheriting its clocks', async () => {
    const { store, clock, seed } = await make();
    const foreign = { ...seed({ vouchers: 3 }), vouchers: 99, lastSeenWallClock: T0 - 30 * 86_400_000, uptimeAtSave: 0 };
    const code = encodeSave(serialize(foreign));
    expect(await store.getState().importSaveCode(code)).toBe('ok');
    expect(store.getState().state.vouchers).toBe(99);
    expect(store.getState().state.lastSeenWallClock).toBe(clock.wall());
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });
});
