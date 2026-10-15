import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from './state';
import { content } from '../data';
import { markOfferShown, nextOffer, OFFER_REVIEW_GAP_MS } from './offers';
import { grantPremium } from './premium';

const DAY = 86_400_000;
const T0 = 1_800_000_000_000;

/** A player past the tutorial, on a known day, who joined at T0. */
function player(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState({ wall: T0, mono: 0 }, content);
  return { ...s, onboarding: { ...s.onboarding, trainingStep: 3 }, dailies: { ...s.dailies, date: '2026-10-15' }, ...patch };
}

describe('store offers', () => {
  it('never shows during the tutorial', () => {
    const s = player();
    expect(nextOffer({ ...s, onboarding: { ...s.onboarding, trainingStep: 2 } }, T0)).toBeNull();
  });
  it('offers the Starter Pack once, in the first 3 days only', () => {
    const s = player();
    expect(nextOffer(s, T0)?.product).toBe('starter_pack');
    expect(nextOffer(s, T0 + 4 * DAY)).toBeNull();
    const seen = markOfferShown(s, 'starter');
    expect(nextOffer({ ...seen, offers: { ...seen.offers, lastDate: '2026-10-14' } }, T0)).toBeNull();
  });
  it('shows at most one offer a day', () => {
    const s = markOfferShown(player({ stats: { ...player().stats, audits: 1 } }), 'starter');
    expect(nextOffer(s, T0)).toBeNull();
    const tomorrow = { ...s, dailies: { ...s.dailies, date: '2026-10-16' } };
    expect(nextOffer(tomorrow, T0 + 4 * DAY)?.product).toBe('cerberus_bundle');
  });
  it('waits after a rating prompt', () => {
    const s = player({ review: { asks: 1, lastWall: T0 } });
    expect(nextOffer(s, T0 + 60_000)).toBeNull();
    expect(nextOffer(s, T0 + OFFER_REVIEW_GAP_MS + 1)?.product).toBe('starter_pack');
  });
  it('pitches Cerberus after the first audit, unless already owned', () => {
    const base = player({ stats: { ...player().stats, audits: 1 } });
    const later = T0 + 4 * DAY;
    expect(nextOffer(base, later)?.product).toBe('cerberus_bundle');
    expect(nextOffer(grantPremium(base, ['cerberus']), later)).toBeNull();
  });
  it('pitches Remove Ads after 3 rewarded ads, unless already bought', () => {
    const base = player({ stats: { ...player().stats, adsWatched: 3 } });
    const later = T0 + 4 * DAY;
    expect(nextOffer(base, later)?.product).toBe('remove_ads');
    expect(nextOffer({ ...base, entitlements: { ...base.entitlements, removeAds: true } }, later)).toBeNull();
  });
});
