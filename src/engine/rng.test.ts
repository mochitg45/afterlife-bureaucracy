import { xorshift32, nextFloat } from './rng';

describe('xorshift32', () => {
  it('is deterministic and never returns 0', () => {
    expect(xorshift32(1)).toBe(xorshift32(1));
    let s = 1;
    for (let i = 0; i < 10000; i++) {
      s = xorshift32(s);
      expect(s).not.toBe(0);
    }
    expect(xorshift32(0)).not.toBe(0);
  });
  it('yields floats in [0,1) with a roughly uniform mean', () => {
    let s = 42,
      sum = 0;
    for (let i = 0; i < 20000; i++) {
      const r = nextFloat(s);
      s = r.seed;
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      sum += r.value;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
});
