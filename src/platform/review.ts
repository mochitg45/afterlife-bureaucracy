import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';

/**
 * Audit counts whose ceremony, once dismissed, asks for a store rating. An Audit is the game's
 * happiest beat and they come days apart, so these double as "after some time played". Never
 * with a reward: both stores forbid paying for ratings. The OS throttles the sheet itself.
 */
export const REVIEW_AT_AUDITS: readonly number[] = [2, 6];

/** At most this many in-game asks, at least this far apart; the OS throttles on top. */
export const REVIEW_MAX_ASKS = 3;
export const REVIEW_GAP_MS = 3 * 86_400_000;

/** Whether a happy moment may ask now, given the asks so far. */
export function reviewAllowed(review: { asks: number; lastWall: number }, nowWall: number): boolean {
  return review.asks < REVIEW_MAX_ASKS && nowWall - review.lastWall >= REVIEW_GAP_MS;
}

/** Whether closing the ceremony of audit number `audits` should ask for a rating. */
export const shouldAskForReview = (audits: number): boolean => REVIEW_AT_AUDITS.includes(audits);

/** Shows the store's own rating sheet on a device; a no-op in a browser, and never throws. */
export async function requestReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await InAppReview.requestReview();
  } catch {
    // No sheet is fine — the store may have throttled it.
  }
}
