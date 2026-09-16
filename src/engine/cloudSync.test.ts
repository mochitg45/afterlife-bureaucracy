import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { pickWinner, summarize } from './cloudSync';
import { content } from '../data';

const base = () => createInitialState({ wall: 1_700_000_000_000, mono: 0 }, content);
const withSouls = (n: number, savedAtWall = 0) => ({ ...base(), soulsLifetime: new Decimal(n), savedAtWall });

describe('pickWinner', () => {
  it('prefers the save with more lifetime souls', () => {
    expect(pickWinner(withSouls(10), withSouls(500))).toBe('cloud');
    expect(pickWinner(withSouls(900), withSouls(500))).toBe('local');
  });
  it('breaks a tie by the later savedAtWall, then local', () => {
    expect(pickWinner(withSouls(10, 100), withSouls(10, 200))).toBe('cloud');
    expect(pickWinner(withSouls(10, 300), withSouls(10, 200))).toBe('local');
    expect(pickWinner(withSouls(10, 200), withSouls(10, 200))).toBe('local');
  });
});
describe('summarize', () => {
  it('reports the fields the notice shows', () => {
    const s = { ...withSouls(42, 7), fiscalYear: 3, seals: 12 };
    expect(summarize(s)).toEqual({ soulsLifetime: new Decimal(42), savedAtWall: 7, fiscalYear: 3, seals: 12 });
  });
});
