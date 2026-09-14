import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize, SAVE_VERSION, type GameState } from './state';
import { loadContent } from './content';
import { content } from '../data';
import intake from '../data/departments/intake.json';
import saveV1 from './fixtures/save-v1.json';
import saveV2 from './fixtures/save-v2.json';
import saveV3 from './fixtures/save-v3.json';

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
    const raw = { saveVersion: 3, deptsUnlocked: ['intake', 'valhalla'], activeDept: 'valhalla' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
  });
  it('falls back to the starting departments when every saved one is unknown', () => {
    const raw = { saveVersion: 3, deptsUnlocked: ['valhalla'], activeDept: 'valhalla' };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
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
    expect(s.saveVersion).toBe(3);
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

describe('exhaustive save round-trip', () => {
  it('carries every field of a fully non-default state through serialize/deserialize', () => {
    const s: GameState = {
      saveVersion: SAVE_VERSION,
      kc: new Decimal('1e40'),
      soulsRun: new Decimal('2e40'),
      soulsLifetime: new Decimal('3e40'),
      seals: 42,
      vouchers: 17,
      perks: ['throughput-1', 'headstart-1'],
      staff: { dave: 11, seraphine: 3 },
      upgrades: { 'faster-stapler': 2 },
      deptsUnlocked: ['intake', 'heaven'],
      activeDept: 'heaven',
      fiscalYear: 6,
      boostUntilWall: 1_700_000_123_456,
      lastSeenWallClock: 1_700_000_000_000,
      uptimeAtSave: 98_765,
      stats: { clicks: 7, staffHired: 14, upgradesBought: 5, audits: 5 },
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
