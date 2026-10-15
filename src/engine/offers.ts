import type { GameState } from './state';
import type { ProductId } from '../platform/billing';
import { starterPackEligible } from './entitlements';
import { ownsPremium } from './premium';
import { eventPool } from './events';

/**
 * Soft store offers: a pop-up at a good moment, never a paywall. Each offer is shown once,
 * at most one a day, never during the tutorial and never right after a rating prompt.
 */
export interface Offer { id: string; product: ProductId }

/** A rating prompt and a sales pitch back to back reads as nagging. */
export const OFFER_REVIEW_GAP_MS = 30 * 60_000;
/** Rewarded ads watched before Remove Ads is pitched: the player has felt the ads by then. */
export const OFFER_ADS_WATCHED = 3;

export function nextOffer(state: GameState, nowWall: number): Offer | null {
  const { offers, dailies } = state;
  if (state.onboarding.trainingStep < 3 || !dailies.date || offers.lastDate === dailies.date) return null;
  if (nowWall - state.review.lastWall < OFFER_REVIEW_GAP_MS) return null;
  const fresh = (id: string) => !offers.seen.includes(id);
  // Most time-limited first: the Starter Pack and an event's pass expire, the rest can wait.
  if (fresh('starter') && starterPackEligible(state, nowWall)) return { id: 'starter', product: 'starter_pack' };
  const ev = state.event;
  if (ev && !ev.pass && fresh(`pass:${ev.key}`)) {
    return { id: `pass:${ev.key}`, product: eventPool(ev.key) === 'special' ? 'holiday_pass' : 'weekly_pass' };
  }
  if (fresh('cerberus') && state.stats.audits >= 1 && !ownsPremium(state, 'cerberus')) return { id: 'cerberus', product: 'cerberus_bundle' };
  if (fresh('remove_ads') && state.stats.adsWatched >= OFFER_ADS_WATCHED && !state.entitlements.removeAds) return { id: 'remove_ads', product: 'remove_ads' };
  return null;
}

export function markOfferShown(state: GameState, id: string): GameState {
  return { ...state, offers: { seen: [...state.offers.seen, id].slice(-100), lastDate: state.dailies.date } };
}
