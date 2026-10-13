import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: { requestReview: vi.fn() } }));

import { shouldAskForReview } from './review';

describe('shouldAskForReview', () => {
  it('asks only at the threshold audits', () => {
    expect([0, 1, 2, 3, 5, 6, 7].map(shouldAskForReview)).toEqual([false, false, true, false, false, true, false]);
  });
});

describe('reviewAllowed', () => {
  it('allows at most three asks, three days apart', async () => {
    const { reviewAllowed, REVIEW_GAP_MS } = await import('./review');
    expect(reviewAllowed({ asks: 0, lastWall: 0 }, 1_000)).toBe(true);
    expect(reviewAllowed({ asks: 1, lastWall: 10_000 }, 10_000 + REVIEW_GAP_MS - 1)).toBe(false);
    expect(reviewAllowed({ asks: 1, lastWall: 10_000 }, 10_000 + REVIEW_GAP_MS)).toBe(true);
    expect(reviewAllowed({ asks: 3, lastWall: 0 }, 1e13)).toBe(false);
  });
});
