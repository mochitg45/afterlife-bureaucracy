import type Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
// Type-only: the engine never loads a platform module at runtime, so importing the product
// id union here costs nothing and keeps one source of truth for the store ids.
import type { ProductId } from '../platform/billing';
import { grantVouchersExact } from './vouchers';

/** Union Membership: +25% on everything the office earns, for as long as it runs. */
export const UNION_GLOBAL_MULT = 1.25;
/** Vouchers handed to a member on each daily rollover. Exact — never multiplied. */
export const UNION_ROLLOVER_VOUCHERS = 2;
/** One month of membership per purchase. */
export const UNION_PERIOD_MS = 30 * 86_400_000;
/** Remove-Ads pays double on the Overnight Backlog Report, permanently. */
export const REMOVE_ADS_OFFLINE_MULT = 2;
/** The Starter Pack is only offered to a clerk who joined within this window. */
export const STARTER_PACK_WINDOW_MS = 3 * 86_400_000;
export const STARTER_PACK_VOUCHERS = 200;
export const STARTER_PACK_CARD = 'c-grandma-liu';
/** KC equal to half an hour of the player's current income. */
export const STARTER_PACK_KC_SECONDS = 1800;

/** Voucher packs and what each one pays out. Everything else is an entitlement, not a quantity. */
export const VOUCHER_PACKS: Partial<Record<ProductId, number>> = {
  vouchers_10: 100,
  vouchers_55: 550,
  vouchers_120: 1200,
  vouchers_300: 3000,
};

/** Only the field every check below reads, so a React caller can subscribe to it alone. */
export type EntitlementHolder = Pick<GameState, 'entitlements'>;

export function unionActive(state: EntitlementHolder, nowWall: number): boolean {
  return state.entitlements.unionUntilWall > nowWall;
}

/** The membership's slice of the global multiplier: 1 when it has lapsed. */
export function unionGlobalMult(state: EntitlementHolder, nowWall: number): number {
  return unionActive(state, nowWall) ? UNION_GLOBAL_MULT : 1;
}

/** Remove-Ads is the only thing that scales offline earnings; ×1 without it. */
export function offlineEarningsMult(state: EntitlementHolder): number {
  return state.entitlements.removeAds ? REMOVE_ADS_OFFLINE_MULT : 1;
}

export type StarterPackWallet = Pick<GameState, 'entitlements' | 'firstSeenWallClock'>;

/** Once, and only inside the first three days on the job. */
export function starterPackEligible(state: StarterPackWallet, nowWall: number): boolean {
  return !state.entitlements.starterPackBought && nowWall - state.firstSeenWallClock <= STARTER_PACK_WINDOW_MS;
}

/**
 * Applies a completed purchase. The store has already been paid by the time this runs, so
 * every grant lands unconditionally: whether the Starter Pack was still on offer is the
 * caller's call (`starterPackEligible`), made *before* the billing flow, never here — a
 * refused grant after a successful charge would cost the player money for nothing.
 *
 * Voucher grants go through `grantVouchersExact`: a purchased quantity is a quantity, not
 * something the requisition perks get to multiply.
 */
export function applyPurchase(
  state: GameState,
  content: Content,
  id: ProductId,
  nowWall: number,
  kcPerSec: Decimal,
): GameState {
  const next: GameState = { ...state, stats: { ...state.stats, purchases: state.stats.purchases + 1 } };
  const pack = VOUCHER_PACKS[id];
  if (pack) return grantVouchersExact(next, pack);
  switch (id) {
    case 'remove_ads':
      return { ...next, entitlements: { ...next.entitlements, removeAds: true } };
    case 'union_monthly':
      // Renewing early extends the term rather than restarting it; renewing after a lapse
      // starts from now, so a lapsed month is never paid for twice.
      return {
        ...next,
        entitlements: {
          ...next.entitlements,
          unionUntilWall: Math.max(nowWall, next.entitlements.unionUntilWall) + UNION_PERIOD_MS,
        },
      };
    case 'starter_pack': {
      const withVouchers = grantVouchersExact(next, STARTER_PACK_VOUCHERS);
      const card = content.cards.find((c) => c.id === STARTER_PACK_CARD);
      // max(stars, 1): a player who already pulled the card keeps their star rank.
      const cards = card ? { ...withVouchers.cards, [card.id]: Math.max(withVouchers.cards[card.id] ?? 0, 1) } : withVouchers.cards;
      return {
        ...withVouchers,
        cards,
        kc: withVouchers.kc.add(kcPerSec.mul(STARTER_PACK_KC_SECONDS)),
        entitlements: { ...withVouchers.entitlements, starterPackBought: true },
      };
    }
    default:
      return next;
  }
}
