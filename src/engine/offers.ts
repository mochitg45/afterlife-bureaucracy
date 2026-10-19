import type { GameState } from './state';
import type { ProductId } from '../platform/billing';
import { starterPackEligible } from './entitlements';
import { ownsPremium, onSale, premiumDef } from './premium';
import { eventPool } from './events';

/**
 * The store offer pop-up shown when the app opens (like most mobile games), never a paywall:
 * once per app open, only after the tutorial, never within 30 min of a rating prompt, and not
 * at all on a day the player ticked "Don't show again today". Offers rotate: each open shows
 * the one shown longest ago, with time-limited ones (a limited pet, the Starter Pack, an
 * event's pass) first in line.
 *
 * `offers.seen` is the rotation log (oldest first); `offers.lastDate` is the day the player
 * snoozed the pop-up ('' when not snoozed).
 */
export interface Offer { id: string; product: ProductId }

/** A rating prompt and a sales pitch back to back reads as nagging. */
export const OFFER_REVIEW_GAP_MS = 30 * 60_000;

/** Every offer the player could take right now, most time-limited first. */
export function offerCandidates(state: GameState, nowWall: number, runningEventId: string | null): Offer[] {
  const out: Offer[] = [];
  const pumpkat = premiumDef('pumpkat');
  if (pumpkat && onSale(pumpkat, runningEventId) && !ownsPremium(state, 'pumpkat')) out.push({ id: 'pumpkat', product: 'pumpkat_bundle' });
  if (starterPackEligible(state, nowWall)) out.push({ id: 'starter', product: 'starter_pack' });
  const ev = state.event;
  if (ev && !ev.pass) out.push({ id: 'pass', product: eventPool(ev.key) === 'special' ? 'holiday_pass' : 'weekly_pass' });
  if (!ownsPremium(state, 'cerberus')) out.push({ id: 'cerberus', product: 'cerberus_bundle' });
  if (!state.entitlements.removeAds) out.push({ id: 'remove_ads', product: 'remove_ads' });
  return out;
}

export function nextOffer(state: GameState, nowWall: number, runningEventId: string | null = null): Offer | null {
  const { offers, dailies } = state;
  if (state.onboarding.trainingStep < 3 || !dailies.date || offers.lastDate === dailies.date) return null;
  if (nowWall - state.review.lastWall < OFFER_REVIEW_GAP_MS) return null;
  const list = offerCandidates(state, nowWall, runningEventId);
  if (!list.length) return null;
  // Shown longest ago (never = -1) wins; ties keep the time-limited-first order.
  const last = (id: string) => offers.seen.lastIndexOf(id);
  return list.reduce((best, o) => (last(o.id) < last(best.id) ? o : best));
}

/** Logs an offer as shown, so the next app open rotates to another one. */
export function markOfferShown(state: GameState, id: string): GameState {
  return { ...state, offers: { ...state.offers, seen: [...state.offers.seen.filter((s) => s !== id), id].slice(-50) } };
}

/** "Don't show again today": no offer pop-up until the next daily rollover. */
export function snoozeOffers(state: GameState): GameState {
  return { ...state, offers: { ...state.offers, lastDate: state.dailies.date } };
}
