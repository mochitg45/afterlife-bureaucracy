import { describe, it, expect } from 'vitest';
import Decimal from 'break_infinity.js';
import { initialRush, startRound, rushAvailable, rushPayout, comboMult, sanitizeRush, RUSH_COOLDOWN_MS, RUSH_CAP_SEC } from './rush';

describe('stamp rush', () => {
  it('locks for 20 minutes after the third round and then frees', () => {
    let r = initialRush();
    for (let i = 0; i < 3; i++) { expect(rushAvailable(r, 1000)).toBe(true); r = startRound(r, 1000); }
    expect(rushAvailable(r, 1000 + RUSH_COOLDOWN_MS - 1)).toBe(false);
    expect(rushAvailable(r, 1000 + RUSH_COOLDOWN_MS)).toBe(true);
  });
  it('ignores a cooldown pushed absurdly far into the future', () => {
    expect(rushAvailable({ rounds: 0, cooldownUntil: 1e15 }, 5)).toBe(false);
    expect(rushAvailable(sanitizeRush({ rounds: 'x', cooldownUntil: NaN }), 5)).toBe(true);
  });
  it('multiplier runs 1x to 3x at a 30 combo', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(30)).toBe(3);
    expect(comboMult(99)).toBe(3);
  });
  it('caps the payout under five minutes of idle, whatever is claimed', () => {
    const rate = new Decimal(100);
    expect(rushPayout(1e9, rate, rate).souls.toNumber()).toBe(100 * RUSH_CAP_SEC);
    expect(RUSH_CAP_SEC).toBeLessThan(300);
    expect(rushPayout(NaN, rate, rate).souls.toNumber()).toBe(0);
  });
});
