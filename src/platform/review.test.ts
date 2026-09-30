import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: { requestReview: vi.fn() } }));

import { shouldAskForReview } from './review';

describe('shouldAskForReview', () => {
  it('asks only at the threshold audits', () => {
    expect([0, 1, 2, 3, 5, 6, 7].map(shouldAskForReview)).toEqual([false, false, true, false, false, true, false]);
  });
});
