import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize, SAVE_VERSION, type GameState } from './state';
import { loadContent } from './content';
import { content } from '../data';
import intake from '../data/departments/intake.json';
import saveV1 from './fixtures/save-v1.json';
import saveV2 from './fixtures/save-v2.json';
import saveV3 from './fixtures/save-v3.json';
import saveV4 from './fixtures/save-v4.json';
import saveV5 from './fixtures/save-v5.json';
import saveV6 from './fixtures/save-v6.json';
import saveV7 from './fixtures/save-v7.json';
import saveV8 from './fixtures/save-v8.json';

const now = { wall: 1_700_000_000_000, mono: 5_000 };

describe('state', () => {
  it('creates an initial state with intake unlocked', () => {
    const s = createInitialState(now, content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(0)).toBe(true);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
    expect(s.lastSeenWallClock).toBe(now.wall);
    expect(s.uptimeAtSave).toBe(now.mono);
  });
  it('unlocks every department whose unlockSouls is 0', () => {
    const two = loadContent([
      intake,
      { ...intake, id: 'lobby', name: 'Lobby', unlockSouls: 0,
        staff: intake.staff.map((s) => ({ ...s, id: 'l-' + s.id })),
        upgrades: intake.upgrades.map((u) => ({ ...u, id: 'l-' + u.id })) },
    ]);
    const s = createInitialState(now, two);
    expect(s.deptsUnlocked).toEqual(['intake', 'lobby']);
    expect(s.activeDept).toBe('intake');
  });
  it('round-trips Decimal fields through serialize/deserialize', () => {
    const s = createInitialState(now, content);
    s.kc = new Decimal('1.5e40');
    s.soulsRun = new Decimal(123);
    s.staff.dave = 7;
    const back = deserialize(serialize(s), content);
    expect(back.kc.eq(new Decimal('1.5e40'))).toBe(true);
    expect(back.soulsRun.eq(123)).toBe(true);
    expect(back.staff.dave).toBe(7);
  });
  it('loads the v2 fixture', () => {
    const s = deserialize(JSON.stringify(saveV2), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(new Decimal('2500'))).toBe(true);
    expect(s.staff.dave).toBe(12);
  });
  it('loads the v1 fixture through the boost migration', () => {
    const s = deserialize(JSON.stringify(saveV1), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(new Decimal('2500'))).toBe(true);
    expect(s.boostUntilWall).toBe(0);
  });
  it('rejects a save from the future', () => {
    const s = createInitialState(now, content);
    const raw = JSON.parse(serialize(s));
    raw.saveVersion = SAVE_VERSION + 1;
    expect(() => deserialize(JSON.stringify(raw), content)).toThrow(/newer/i);
  });
  it('rejects a save version with no migration step instead of wiping it', () => {
    const raw = { saveVersion: 0, kc: '10' };
    expect(() => deserialize(JSON.stringify(raw), content)).toThrow('No migration step for save version 0');
  });
  it('accepts a numeric-string saveVersion and still migrates it', () => {
    const raw = { saveVersion: '2', kc: '10', boostUntilWall: 5 };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.boostUntilWall).toBe(5);
    expect(s.perks).toEqual([]);
  });
  it('fills missing fields from a partial old save', () => {
    const raw = { saveVersion: 2, kc: '10', soulsRun: '10', soulsLifetime: '10' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.staff).toEqual({});
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.stats.clicks).toBe(0);
  });
  it('coerces numeric-string owned counts and drops junk entries', () => {
    const raw = { saveVersion: 2, staff: { dave: '5', gary: 'nope', seraphine: -3, auditor: 2 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.staff.dave).toBe(5);
    expect(s.staff.auditor).toBe(2);
    expect(s.staff.gary).toBeUndefined();
    expect(s.staff.seraphine).toBeUndefined();
  });
  it('drops departments the build no longer ships and repairs the active one', () => {
    const raw = { saveVersion: 3, deptsUnlocked: ['intake', 'atlantis'], activeDept: 'atlantis' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
  });
  it('falls back to the starting departments when every saved one is unknown', () => {
    const raw = { saveVersion: 3, deptsUnlocked: ['atlantis'], activeDept: 'atlantis' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
  });
  it('drops perks the build no longer ships and de-duplicates the rest', () => {
    const known = content.perks[0].id;
    const raw = { saveVersion: 3, perks: [known, 'p-atlantis', known, 42] };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.perks).toEqual([known]);
  });
  it('falls back to zero for an unparseable Decimal field', () => {
    const raw = { saveVersion: 2, kc: 'abc', soulsRun: null, soulsLifetime: '1e5' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.kc.toNumber()).toBe(0);
    expect(s.soulsRun.toNumber()).toBe(0);
    expect(s.soulsLifetime.toNumber()).toBe(1e5);
  });
});

describe('save v3', () => {
  it('initial state has no perks', () => {
    expect(createInitialState(now, content).perks).toEqual([]);
  });
  it('migrates v2 saves by adding an empty perk list', () => {
    const s = deserialize(JSON.stringify(saveV2), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.perks).toEqual([]);
  });
  it('loads the v3 fixture with perks', () => {
    const s = deserialize(JSON.stringify(saveV3), content);
    expect(s.perks).toEqual(['throughput-1']);
  });
  it('drops non-string perk entries', () => {
    const raw = { ...saveV3, perks: ['throughput-1', 7, null] };
    expect(deserialize(JSON.stringify(raw), content).perks).toEqual(['throughput-1']);
  });
});

describe('save v4', () => {
  it('initial state has empty retention fields', () => {
    const s = createInitialState(now, content);
    expect(s.cards).toEqual({});
    expect(s.equipped).toEqual([]);
    expect(s.pity).toEqual({ senior: 0, executive: 0 });
    expect(s.rngSeed).toBeGreaterThan(0);
    expect(s.dailies.tasks).toEqual([]);
    expect(s.dailies.streak).toBe(0);
    expect(s.achievements).toEqual([]);
    expect(s.storySeen).toEqual([]);
    expect(s.settings.notifOptIn).toBe('unasked');
    expect(s.firstSeenWallClock).toBe(now.wall);
    expect(s.stats.pulls).toBe(0);
  });
  it('migrates a v3 save to v4 with defaults', () => {
    const s = deserialize(JSON.stringify(saveV3), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.cards).toEqual({});
    expect(s.dailies.date).toBe('');
    expect(s.firstSeenWallClock).toBe(saveV3.lastSeenWallClock);
  });
  it('loads the v4 fixture', () => {
    const s = deserialize(JSON.stringify(saveV4), content);
    expect(s.cards).toEqual({ 'c-dave-overtime': 2 });
    expect(s.equipped).toEqual(['c-dave-overtime']);
    expect(s.pity).toEqual({ senior: 4, executive: 12 });
    expect(s.dailies.streak).toBe(3);
  });
  it('sanitises retention fields', () => {
    const raw = { ...saveV4, cards: { 'c-dave-overtime': 9, junk: 'x' }, equipped: ['c-dave-overtime', 5, 'c-dave-overtime'], pity: { senior: -1 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.cards).toEqual({ 'c-dave-overtime': 5 });
    expect(s.equipped).toEqual(['c-dave-overtime']);
    expect(s.pity).toEqual({ senior: 0, executive: 0 });
  });
  it('seeds the RNG per save from its own timestamp rather than a shared constant', () => {
    const a = deserialize(JSON.stringify({ ...saveV3, lastSeenWallClock: 1_700_000_000_000 }), content);
    const b = deserialize(JSON.stringify({ ...saveV3, lastSeenWallClock: 1_700_000_777_000 }), content);
    expect(a.rngSeed).toBeGreaterThan(0);
    expect(b.rngSeed).toBeGreaterThan(0);
    expect(a.rngSeed).not.toBe(b.rngSeed);
  });
});

describe('save v5', () => {
  it('initial state carries the v5 defaults', () => {
    const s = createInitialState(now, content);
    expect(s.voucherFraction).toBe(0);
    expect(s.dailies.soulsPerSecSnapshot).toBe('0');
    expect(s.settings.notifDate).toBe('');
    expect(s.settings.notifsSent).toBe(0);
  });
  it('migrates a v4 save to v5 with defaults, keeping the rest of its dailies and settings', () => {
    const s = deserialize(JSON.stringify(saveV4), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.voucherFraction).toBe(0);
    expect(s.dailies.soulsPerSecSnapshot).toBe('0');
    expect(s.dailies.streak).toBe(3);
    expect(s.settings).toEqual({ notifOptIn: 'unasked', notifDate: '', notifsSent: 0, theme: 'light', sfx: true, music: true });
  });
  it('loads the v5 fixture', () => {
    const s = deserialize(JSON.stringify(saveV5), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.voucherFraction).toBeCloseTo(0.4);
    expect(s.dailies.soulsPerSecSnapshot).toBe('42');
    expect(s.settings).toEqual({ notifOptIn: 'yes', notifDate: '2026-09-14', notifsSent: 1, theme: 'light', sfx: true, music: true });
  });
  it('drops an out-of-range voucher remainder and a negative notification count', () => {
    const raw = { ...saveV5, voucherFraction: 3.5, settings: { ...saveV5.settings, notifsSent: -4, notifDate: 7 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.voucherFraction).toBe(0);
    expect(s.settings.notifsSent).toBe(0);
    expect(s.settings.notifDate).toBe('');
  });
  it('defaults sfx and music to on and coerces garbage to booleans', () => {
    const raw = { ...saveV5, settings: { ...saveV5.settings, sfx: 'nope', music: 0 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.settings.sfx).toBe(true);
    expect(s.settings.music).toBe(false);
  });
  it('defaults theme to light and rejects a garbage value', () => {
    const raw = { ...saveV5, settings: { ...saveV5.settings, theme: 'nope' } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.settings.theme).toBe('light');
  });
  it('carries a saved dark theme through deserialize', () => {
    const raw = { ...saveV5, settings: { ...saveV5.settings, theme: 'dark' } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.settings.theme).toBe('dark');
  });
  it('clamps a save carrying more equipped cards than the state has slots', () => {
    const five = ['c-dave-overtime', 'c-seraphine-chipper', 'c-gary-break', 'c-cherub-choir', 'c-imp-qa'];
    const cards = Object.fromEntries(five.map((id) => [id, 1]));
    const raw = { ...saveV5, perks: [], cards, equipped: five };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.equipped).toEqual(five.slice(0, 3));
  });
});

describe('save v6', () => {
  it('initial state carries the v6 defaults', () => {
    const s = createInitialState(now, content);
    expect(s.entitlements).toEqual({ removeAds: false, unionUntilWall: 0, starterPackBought: false, firstBuyUsed: {} });
    expect(s.adState).toEqual({ freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 });
    expect(s.cosmicPoints).toBe(0);
    expect(s.cosmicClauses).toEqual([]);
    expect(s.branchesUnlocked).toEqual([]);
    expect(s.processId).toBe('');
    expect(s.stats.cosmics).toBe(0);
    expect(s.stats.purchases).toBe(0);
  });
  it('migrates a v5 save to v6 with defaults, keeping the rest of it', () => {
    const s = deserialize(JSON.stringify(saveV5), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.entitlements).toEqual({ removeAds: false, unionUntilWall: 0, starterPackBought: false, firstBuyUsed: {} });
    expect(s.adState).toEqual({ freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 });
    expect(s.cosmicPoints).toBe(0);
    expect(s.cosmicClauses).toEqual([]);
    expect(s.branchesUnlocked).toEqual([]);
    expect(s.processId).toBe('');
    expect(s.stats.cosmics).toBe(0);
    expect(s.stats.purchases).toBe(0);
    expect(s.voucherFraction).toBeCloseTo(0.4);
    expect(s.dailies.streak).toBe(3);
  });
  it('loads the v6 fixture', () => {
    const s = deserialize(JSON.stringify(saveV6), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.entitlements).toEqual({ removeAds: true, unionUntilWall: 1700000600000, starterPackBought: true, firstBuyUsed: {} });
    expect(s.adState).toEqual({ freePullDate: '2026-09-14', dailySkipDate: '2026-09-13', boostCooldownUntilWall: 1700000300000 });
    expect(s.cosmicPoints).toBe(2);
    expect(s.cosmicClauses).toEqual(['clause-throughput-1']);
    expect(s.branchesUnlocked).toEqual(['valhalla']);
    expect(s.processId).toBe('abc123');
    expect(s.stats.cosmics).toBe(1);
    expect(s.stats.purchases).toBe(3);
  });
  it('sanitises the entitlement and ad-state fields', () => {
    const raw = {
      ...saveV6,
      entitlements: { removeAds: 'yes', unionUntilWall: -5, starterPackBought: 1, firstBuyUsed: { vouchers_10: 'yes' } },
      adState: { freePullDate: 7, dailySkipDate: null, boostCooldownUntilWall: -200 },
      cosmicPoints: -3,
      stats: { ...saveV6.stats, cosmics: -1, purchases: 'x' },
    };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.entitlements).toEqual({ removeAds: false, unionUntilWall: 0, starterPackBought: false, firstBuyUsed: {} });
    expect(s.adState).toEqual({ freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 });
    expect(s.cosmicPoints).toBe(0);
    expect(s.stats.cosmics).toBe(0);
    expect(s.stats.purchases).toBe(0);
  });
  it('drops non-string and duplicate clause and branch ids', () => {
    const raw = { ...saveV6, cosmicClauses: ['clause-throughput-1', 7, 'clause-throughput-1', null], branchesUnlocked: ['valhalla', 'valhalla', false] };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.cosmicClauses).toEqual(['clause-throughput-1']);
    expect(s.branchesUnlocked).toEqual(['valhalla']);
  });
  it('falls back to empty arrays when the clause fields are not arrays', () => {
    const raw = { ...saveV6, cosmicClauses: 'clause-throughput-1', branchesUnlocked: 3, processId: 42 };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.cosmicClauses).toEqual([]);
    expect(s.branchesUnlocked).toEqual([]);
    expect(s.processId).toBe('');
  });
});

describe('save v7', () => {
  it('initial state carries the v7 defaults', () => {
    const s = createInitialState(now, content);
    expect(s.onboarding).toEqual({ memosSeen: false, trainingStep: 0 });
    expect(s.cloud).toEqual({ lastSyncWall: 0, lastResult: 'none' });
    expect(s.savedAtWall).toBe(0);
  });
  it('migrates a played v6 save to v7 with its onboarding already behind it', () => {
    const s = deserialize(JSON.stringify(saveV6), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    // A save with souls on it belongs to a player who has been here for versions: the memos
    // and the walkthrough are not replayed at them.
    expect(s.onboarding).toEqual({ memosSeen: true, trainingStep: 3 });
    expect(s.cloud).toEqual({ lastSyncWall: 0, lastResult: 'none' });
    expect(s.savedAtWall).toBe(0);
    expect(s.entitlements).toEqual({ removeAds: true, unionUntilWall: 1700000600000, starterPackBought: true, firstBuyUsed: {} });
    expect(s.voucherFraction).toBeCloseTo(0.4);
  });
  it('loads the v7 fixture', () => {
    const s = deserialize(JSON.stringify(saveV7), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.onboarding).toEqual({ memosSeen: true, trainingStep: 3 });
    expect(s.cloud).toEqual({ lastSyncWall: 1700000001000, lastResult: 'uploaded' });
    expect(s.savedAtWall).toBe(1700000002000);
  });
  it('clamps trainingStep to 0..3, whitelists lastResult, and defaults a non-number savedAtWall', () => {
    const raw = {
      ...saveV7,
      onboarding: { memosSeen: true, trainingStep: 99 },
      cloud: { lastSyncWall: 5, lastResult: 'bogus' },
      savedAtWall: 'nope',
    };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.onboarding).toEqual({ memosSeen: true, trainingStep: 3 });
    expect(s.cloud).toEqual({ lastSyncWall: 5, lastResult: 'none' });
    expect(s.savedAtWall).toBe(0);
  });
  it('clamps a negative trainingStep up to 0', () => {
    const raw = { ...saveV7, onboarding: { memosSeen: false, trainingStep: -5 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.onboarding.trainingStep).toBe(0);
  });
});

describe('save v8 (playtest round 1: vouchers x10)', () => {
  it('migrates a v7 save to v8, scaling the voucher balance by ten', () => {
    const raw = { ...saveV7, vouchers: 5 };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.vouchers).toBe(50);
    // The carried sub-voucher remainder is not itself a "voucher amount": it is always < 1
    // regardless of grant size, so it survives the migration unscaled.
    expect(s.voucherFraction).toBeCloseTo(0.4);
  });
  it('loads the v8 fixture', () => {
    const s = deserialize(JSON.stringify(saveV8), content);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.vouchers).toBe(50);
    // The two fields v8 saves that nothing else in the fixture exercised: the chosen theme
    // travels with the save, and a pack whose first-purchase bonus is already spent stays spent.
    expect(s.settings.theme).toBe('dark');
    expect(s.entitlements.firstBuyUsed).toEqual({ vouchers_10: true });
  });
  it('gives a v7 save an empty shard bank and keeps only shards for cards this build ships', () => {
    // The migration banks no shards for an old save -- there was no way to earn one -- and a
    // hand-edited save naming a card that no longer exists must not smuggle the id through.
    const migrated = deserialize(JSON.stringify({ ...saveV7, cardShards: { 'c-dave-overtime': 3 } }), content);
    expect(migrated.cardShards).toEqual({});
    const v8 = deserialize(JSON.stringify({ ...saveV8, cardShards: { 'c-dave-overtime': 2, 'c-nobody': 9 } }), content);
    expect(v8.cardShards).toEqual({ 'c-dave-overtime': 2 });
  });
  it('folds an empty firstBuyUsed map into a v7 save migrated to v8, keeping the rest of entitlements', () => {
    const raw = { ...saveV7 };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.entitlements).toEqual({ removeAds: true, unionUntilWall: 1700000600000, starterPackBought: true, firstBuyUsed: {} });
  });
});

describe('exhaustive save round-trip', () => {
  it('carries every field of a fully non-default state through serialize/deserialize', () => {
    const s: GameState = {
      saveVersion: SAVE_VERSION,
      kc: new Decimal('1e40'),
      soulsRun: new Decimal('2e40'),
      soulsLifetime: new Decimal('3e40'),
      seals: 42,
      vouchers: 17,
      voucherFraction: 0.25,
      perks: ['throughput-1', 'headstart-1'],
      staff: { dave: 11, seraphine: 3 },
      upgrades: { 'faster-stapler': 2 },
      deptsUnlocked: ['intake', 'heaven'],
      activeDept: 'heaven',
      fiscalYear: 6,
      boostUntilWall: 1_700_000_123_456,
      lastSeenWallClock: 1_700_000_000_000,
      uptimeAtSave: 98_765,
      stats: { clicks: 7, staffHired: 14, upgradesBought: 5, audits: 5, pulls: 9, equips: 2, dailiesClaimed: 4, adsWatched: 1, perksBought: 3, cosmics: 2, purchases: 4 },
      cards: { 'c-dave-overtime': 3, 'c-seraphine-chipper': 1 },
      cardShards: { 'c-dave-overtime': 2 },
      equipped: ['c-dave-overtime'],
      pity: { senior: 4, executive: 12 },
      rngSeed: 987654321,
      dailies: {
        date: '2026-09-14',
        tasks: [{ id: 'd-clicks-1', claimed: true }, { id: 'd-hire-1', claimed: false }],
        skipped: ['d-upgrades-1'],
        streak: 5,
        bestStreak: 9,
        skipTokens: 2,
        lastTokenDate: '2026-09-08',
        baseline: { clicks: 240, staffHired: 15, upgradesBought: 2, equips: 0, audits: 0, perksBought: 0, pulls: 0, adsWatched: 0 },
        completedToday: true,
        soulsPerSecSnapshot: '1.25e7',
      },
      achievements: ['a-souls-1', 'a-clicks-1'],
      storySeen: ['s-first-stamp', 's-deja-vu'],
      settings: { notifOptIn: 'yes', notifDate: '2026-09-14', notifsSent: 1, theme: 'dark', sfx: true, music: true },
      firstSeenWallClock: 1_699_000_000_000,
      entitlements: { removeAds: true, unionUntilWall: 1_700_000_999_000, starterPackBought: true, firstBuyUsed: { vouchers_10: true } },
      adState: { freePullDate: '2026-09-14', dailySkipDate: '2026-09-13', boostCooldownUntilWall: 1_700_000_555_000 },
      cosmicPoints: 3,
      cosmicClauses: ['clause-throughput-1', 'clause-seals-1'],
      branchesUnlocked: ['valhalla'],
      processId: 'k3f9zq',
      onboarding: { memosSeen: true, trainingStep: 2 },
      cloud: { lastSyncWall: 1_700_000_444_000, lastResult: 'downloaded' },
      savedAtWall: 1_700_000_888_000,
    };
    const back = deserialize(serialize(s), content);
    expect(Object.keys(back).sort()).toEqual(Object.keys(s).sort());
    for (const key of Object.keys(s) as Array<keyof GameState>) {
      const a = s[key];
      const b = back[key];
      if (a instanceof Decimal) expect((b as Decimal).eq(a)).toBe(true);
      else expect(b).toEqual(a);
    }
  });
});
