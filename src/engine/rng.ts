/** Deterministic xorshift32 PRNG: same seed always yields the same next seed, never 0. */
export function xorshift32(seed: number): number {
  let x = (seed >>> 0) || 0x9e3779b9;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return x || 0x9e3779b9;
}

/** Advances the seed and returns a float in [0,1). */
export function nextFloat(seed: number): { seed: number; value: number } {
  const next = xorshift32(seed);
  return { seed: next, value: next / 4294967296 };
}
