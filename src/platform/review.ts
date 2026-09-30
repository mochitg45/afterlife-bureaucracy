import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';

/**
 * Audit counts whose ceremony, once dismissed, asks for a store rating. An Audit is the game's
 * happiest beat and they come days apart, so these double as "after some time played". Never
 * with a reward: both stores forbid paying for ratings. The OS throttles the sheet itself.
 */
export const REVIEW_AT_AUDITS: readonly number[] = [2, 6];

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
