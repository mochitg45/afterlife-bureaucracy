import { describe, it, expect } from 'vitest';
import { content } from '../data';
import { createInitialState } from './state';
import { claimTier, claimableTiers, grantShareReward, nextTier, SHARE_REWARD } from './referral';

const fresh = () => createInitialState({ wall: 1, mono: 0 }, content);

describe('referral engine', () => {
  it('lists tiers reached and not yet taken', () => {
    const s = fresh();
    expect(claimableTiers(s, 2)).toEqual([]);
    expect(claimableTiers(s, 5)).toEqual([3, 5]);
    expect(claimableTiers({ ...s, referral: { ...s.referral, claimedTiers: [3] } }, 12)).toEqual([5, 10]);
  });

  it('pays each tier once', () => {
    const s = fresh();
    const a = claimTier(s, 3, 3);
    expect(a.vouchers).toBe(40);
    expect(a.referral.claimedTiers).toEqual([3]);
    expect(claimTier(a, 3, 3)).toBe(a);
    expect(claimTier(a, 5, 3)).toBe(a); // not reached
    expect(claimTier(a, 4, 99)).toBe(a); // not a tier
    expect(claimTier(claimTier(a, 5, 10), 10, 10).vouchers).toBe(40 + 60 + 150);
  });

  it('pays the share reward once ever', () => {
    const a = grantShareReward(fresh());
    expect(a.vouchers).toBe(SHARE_REWARD);
    expect(grantShareReward(a)).toBe(a);
  });

  it('aims the progress bar at the next tier', () => {
    expect(nextTier(0)?.friends).toBe(3);
    expect(nextTier(3)?.friends).toBe(5);
    expect(nextTier(10)).toBeNull();
  });
});
