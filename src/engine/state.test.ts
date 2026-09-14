import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize, SAVE_VERSION } from './state';
import saveV1 from './fixtures/save-v1.json';

const now = { wall: 1_700_000_000_000, mono: 5_000 };

describe('state', () => {
  it('creates an initial state with intake unlocked', () => {
    const s = createInitialState(now);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(0)).toBe(true);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
    expect(s.lastSeenWallClock).toBe(now.wall);
    expect(s.uptimeAtSave).toBe(now.mono);
  });
  it('round-trips Decimal fields through serialize/deserialize', () => {
    const s = createInitialState(now);
    s.kc = new Decimal('1.5e40');
    s.soulsRun = new Decimal(123);
    s.staff.dave = 7;
    const back = deserialize(serialize(s));
    expect(back.kc.eq(new Decimal('1.5e40'))).toBe(true);
    expect(back.soulsRun.eq(123)).toBe(true);
    expect(back.staff.dave).toBe(7);
  });
  it('loads the v1 fixture', () => {
    const s = deserialize(JSON.stringify(saveV1));
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(new Decimal('2500'))).toBe(true);
  });
  it('rejects a save from the future', () => {
    const s = createInitialState(now);
    const raw = JSON.parse(serialize(s));
    raw.saveVersion = SAVE_VERSION + 1;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer/i);
  });
  it('fills missing fields from a partial old save', () => {
    const raw = { saveVersion: 1, kc: '10', soulsRun: '10', soulsLifetime: '10' };
    const s = deserialize(JSON.stringify(raw));
    expect(s.staff).toEqual({});
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.stats.clicks).toBe(0);
  });
});
