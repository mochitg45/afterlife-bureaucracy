import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from './state';
import { content } from '../data';
import { markOfferShown, nextOffer, snoozeOffers, OFFER_REVIEW_GAP_MS } from './offers';
import { grantPremium } from './premium';

const DAY = 86_400_000;
const T0 = 1_800_000_000_000;
const LATER = T0 + 4 * DAY; // past the Starter Pack's 3-day window

/** A player past the tutorial, on a known day, who joined at T0. */
function player(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState({ wall: T0, mono: 0 }, content);
  return { ...s, onboarding: { ...s.onboarding, trainingStep: 3 }, dailies: { ...s.dailies, date: '2026-10-19' }, ...patch };
}

describe('store offer pop-up', () => {
  it('never shows during the tutorial', () => {
    const s = player();
    expect(nextOffer({ ...s, onboarding: { ...s.onboarding, trainingStep: 2 } }, T0)).toBeNull();
  });
  it('leads with the limited Halloween pet while Halloween runs, then the Starter Pack', () => {
    expect(nextOffer(player(), T0, 'halloween')?.product).toBe('pumpkat_bundle');
    expect(nextOffer(player(), T0, null)?.product).toBe('starter_pack');
    expect(nextOffer(player(), LATER, null)?.product).toBe('cerberus_bundle');
  });
  it('never offers the pet outside Halloween or once owned', () => {
    const owned = grantPremium(player(), ['pumpkat']);
    expect(nextOffer(owned, LATER, 'halloween')?.product).not.toBe('pumpkat_bundle');
    expect(nextOffer(player(), LATER, 'weekly-2026-10-16')?.product).not.toBe('pumpkat_bundle');
  });
  it('rotates to the offer shown longest ago on each app open', () => {
    let s = player();
    const first = nextOffer(s, LATER)!;
    s = markOfferShown(s, first.id);
    const second = nextOffer(s, LATER)!;
    expect(second.id).not.toBe(first.id);
    s = markOfferShown(s, second.id);
    expect(nextOffer(s, LATER)!.id).toBe(first.id);
  });
  it('"Don\'t show again today" silences it until the next day', () => {
    const s = snoozeOffers(player());
    expect(nextOffer(s, LATER)).toBeNull();
    expect(nextOffer({ ...s, dailies: { ...s.dailies, date: '2026-10-20' } }, LATER)).not.toBeNull();
  });
  it('waits after a rating prompt', () => {
    const s = player({ review: { asks: 1, lastWall: LATER } });
    expect(nextOffer(s, LATER + 60_000)).toBeNull();
    expect(nextOffer(s, LATER + OFFER_REVIEW_GAP_MS + 1)).not.toBeNull();
  });
  it('skips what the player already owns', () => {
    const s = grantPremium({ ...player(), entitlements: { ...player().entitlements, removeAds: true } }, ['cerberus']);
    expect(nextOffer(s, LATER)).toBeNull();
  });
});
