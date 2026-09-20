import Decimal from 'break_infinity.js';
import { createInitialState, type GameState } from './state';
import { content } from '../data';
import {
  unionActive,
  unionGlobalMult,
  offlineEarningsMult,
  starterPackEligible,
  applyPurchase,
  VOUCHER_PACKS,
  UNION_GLOBAL_MULT,
  UNION_PERIOD_MS,
  STARTER_PACK_CARD,
  STARTER_PACK_KC_SECONDS,
  STARTER_PACK_VOUCHERS,
  STARTER_PACK_WINDOW_MS,
  REMOVE_ADS_OFFLINE_MULT,
} from './entitlements';

const now = { wall: 1_700_000_000_000, mono: 0 };
const fresh = (): GameState => createInitialState(now, content);
const rate = new Decimal(2);

describe('union membership', () => {
  it('is active only while the subscription runs past now', () => {
    const s = fresh();
    expect(unionActive(s, now.wall)).toBe(false);
    const member = { ...s, entitlements: { ...s.entitlements, unionUntilWall: now.wall + 1 } };
    expect(unionActive(member, now.wall)).toBe(true);
    // The deadline itself is past: an expired membership is not a member.
    expect(unionActive(member, now.wall + 1)).toBe(false);
  });
  it('raises the global multiplier by a quarter while active', () => {
    const s = fresh();
    expect(unionGlobalMult(s, now.wall)).toBe(1);
    expect(unionGlobalMult({ ...s, entitlements: { ...s.entitlements, unionUntilWall: now.wall + 1000 } }, now.wall)).toBe(UNION_GLOBAL_MULT);
    expect(UNION_GLOBAL_MULT).toBe(1.25);
  });
});

describe('remove ads entitlement', () => {
  it('doubles offline earnings and nothing else', () => {
    const s = fresh();
    expect(offlineEarningsMult(s)).toBe(1);
    expect(offlineEarningsMult({ ...s, entitlements: { ...s.entitlements, removeAds: true } })).toBe(REMOVE_ADS_OFFLINE_MULT);
    expect(REMOVE_ADS_OFFLINE_MULT).toBe(2);
  });
});

describe('starter pack eligibility', () => {
  it('lasts three days from first launch and only until bought', () => {
    const s = fresh();
    expect(starterPackEligible(s, now.wall)).toBe(true);
    expect(starterPackEligible(s, now.wall + STARTER_PACK_WINDOW_MS)).toBe(true);
    expect(starterPackEligible(s, now.wall + STARTER_PACK_WINDOW_MS + 1)).toBe(false);
    const bought = { ...s, entitlements: { ...s.entitlements, starterPackBought: true } };
    expect(starterPackEligible(bought, now.wall)).toBe(false);
  });
});

describe('applyPurchase', () => {
  it('grants each voucher pack exactly, ignoring the voucher multiplier', () => {
    // A requisition perk and a carried remainder would both inflate a multiplied grant.
    const s: GameState = { ...fresh(), perks: ['requisition-1'], voucherFraction: 0.9 };
    for (const [id, amount] of Object.entries(VOUCHER_PACKS)) {
      const next = applyPurchase(s, content, id as keyof typeof VOUCHER_PACKS, now.wall, rate);
      expect(next.vouchers, id).toBe(amount);
      expect(next.voucherFraction, id).toBe(0.9);
      expect(next.stats.purchases, id).toBe(1);
    }
    expect(VOUCHER_PACKS).toEqual({ vouchers_10: 100, vouchers_55: 550, vouchers_120: 1200, vouchers_300: 3000 });
  });

  it('remove_ads sets the permanent entitlement', () => {
    const next = applyPurchase(fresh(), content, 'remove_ads', now.wall, rate);
    expect(next.entitlements.removeAds).toBe(true);
    expect(offlineEarningsMult(next)).toBe(2);
    expect(next.stats.purchases).toBe(1);
  });

  it('union_monthly adds thirty days, stacking from the later of now and the current expiry', () => {
    const first = applyPurchase(fresh(), content, 'union_monthly', now.wall, rate);
    expect(first.entitlements.unionUntilWall).toBe(now.wall + UNION_PERIOD_MS);
    // Renewing early extends the existing term rather than restarting it.
    const second = applyPurchase(first, content, 'union_monthly', now.wall + 1000, rate);
    expect(second.entitlements.unionUntilWall).toBe(now.wall + 2 * UNION_PERIOD_MS);
    // Renewing after a lapse starts from now.
    const lapsed = applyPurchase(first, content, 'union_monthly', now.wall + 2 * UNION_PERIOD_MS, rate);
    expect(lapsed.entitlements.unionUntilWall).toBe(now.wall + 3 * UNION_PERIOD_MS);
    expect(UNION_PERIOD_MS).toBe(30 * 86_400_000);
  });

  it('starter_pack grants vouchers, the Senior card and half an hour of income, once', () => {
    const next = applyPurchase(fresh(), content, 'starter_pack', now.wall, rate);
    expect(next.vouchers).toBe(STARTER_PACK_VOUCHERS);
    expect(next.cards[STARTER_PACK_CARD]).toBe(1);
    expect(next.kc.toNumber()).toBe(rate.toNumber() * STARTER_PACK_KC_SECONDS);
    expect(next.entitlements.starterPackBought).toBe(true);
    expect(starterPackEligible(next, now.wall)).toBe(false);
    expect(next.stats.purchases).toBe(1);
  });

  it('starter_pack never demotes a card the player already ranked up', () => {
    const owned: GameState = { ...fresh(), cards: { [STARTER_PACK_CARD]: 4 } };
    expect(applyPurchase(owned, content, 'starter_pack', now.wall, rate).cards[STARTER_PACK_CARD]).toBe(4);
  });
});
